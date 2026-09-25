
-- Check if owner_id column exists, if so add FK to profiles
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'live_sessions' AND column_name = 'owner_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE constraint_name = 'live_sessions_owner_id_fkey' AND table_name = 'live_sessions'
    ) THEN
      ALTER TABLE public.live_sessions
        ADD CONSTRAINT live_sessions_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.profiles(id);
    END IF;
  END IF;
END $$;
;
