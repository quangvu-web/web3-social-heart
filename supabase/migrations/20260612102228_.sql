
CREATE TABLE IF NOT EXISTS public.telegram_community_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  patterns text[] NOT NULL DEFAULT '{}',
  reply_text text NOT NULL,
  parse_mode text NOT NULL DEFAULT 'HTML',
  disable_web_page_preview boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_community_quick_replies TO authenticated;
GRANT ALL ON public.telegram_community_quick_replies TO service_role;

ALTER TABLE public.telegram_community_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage quick replies"
ON public.telegram_community_quick_replies
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_quick_replies_updated_at
BEFORE UPDATE ON public.telegram_community_quick_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.telegram_community_quick_replies (label, patterns, reply_text, sort_order)
VALUES (
  'CAMLY Contract Info',
  ARRAY[
    '\bcontract\b',
    '\bsmart\s*contract\b',
    'hợp\s*đồng',
    '\bcamly(\s*coin)?\b',
    '\bca\s*camly\b',
    '\btoken\s*camly\b',
    '\bbscscan\b'
  ],
  E'👉 <b>Contract Address:</b>\n<code>0x0910320181889fefDE0BB1Ca63962b0A8882e413</code>\n\n👉 <b>BscScan:</b>\n<a href="https://bscscan.com/address/0x0910320181889fefDE0BB1Ca63962b0A8882e413">bscscan.com/address/0x0910320181889fefDE0BB1Ca63962b0A8882e413</a>\n\n👉 <b>Token Tracker:</b> Camly Coin (CAMLY)',
  0
);
;
