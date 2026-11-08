-- Prepared for Lovable to review/apply. No existing data is imported or approved.
CREATE TABLE public.telegram_approved_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (length(question) BETWEEN 8 AND 300),
  aliases text[] NOT NULL DEFAULT '{}',
  match_keys text[] NOT NULL DEFAULT '{}',
  answer text NOT NULL CHECK (length(btrim(answer)) BETWEEN 1 AND 3500),
  language text NOT NULL CHECK (language IN ('vi', 'en')),
  group_id bigint CHECK (group_id < 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'revoked')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  source_conversation_id uuid,
  revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid,
  CHECK (cardinality(aliases) <= 20)
);
REVOKE ALL ON public.telegram_approved_replies FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.telegram_approved_replies TO authenticated;
GRANT ALL ON public.telegram_approved_replies TO service_role;
ALTER TABLE public.telegram_approved_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage approved reply library" ON public.telegram_approved_replies
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE INDEX telegram_approved_replies_match ON public.telegram_approved_replies USING gin(match_keys)
  WHERE status = 'approved';

CREATE FUNCTION public.prepare_telegram_approved_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Every content/scope/expiry edit requires a separate approval again.
    IF ROW(NEW.question, NEW.aliases, NEW.answer, NEW.language, NEW.group_id, NEW.expires_at)
       IS DISTINCT FROM ROW(OLD.question, OLD.aliases, OLD.answer, OLD.language, OLD.group_id, OLD.expires_at) THEN
      NEW.status := 'draft';
    END IF;
    NEW.revision := OLD.revision + 1;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.status := 'draft';
    NEW.revision := 1;
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.aliases) a WHERE a IS NULL OR length(btrim(a)) NOT BETWEEN 8 AND 300) THEN
    RAISE EXCEPTION 'Each alias must contain 8 to 300 characters';
  END IF;
  SELECT array_agg(DISTINCT btrim(regexp_replace(btrim(regexp_replace(lower(normalize(q, NFC)), '\s+', ' ', 'g')), '[?!.。]+$', '')))
    INTO NEW.match_keys FROM unnest(array_prepend(NEW.question, NEW.aliases)) q;
  IF NEW.status = 'approved' THEN
    IF NEW.expires_at <= now() THEN RAISE EXCEPTION 'Approval requires a future expiry'; END IF;
    NEW.approved_at := now();
    NEW.approved_by := auth.uid();
  ELSE
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;
CREATE TRIGGER prepare_telegram_approved_reply BEFORE INSERT OR UPDATE ON public.telegram_approved_replies
  FOR EACH ROW EXECUTE FUNCTION public.prepare_telegram_approved_reply();
REVOKE ALL ON FUNCTION public.prepare_telegram_approved_reply() FROM PUBLIC;
