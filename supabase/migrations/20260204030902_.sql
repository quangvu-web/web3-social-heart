-- Add has_password_set column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_password_set BOOLEAN DEFAULT false;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_has_password_set 
ON public.profiles(has_password_set) WHERE has_password_set = true;

-- Comment
COMMENT ON COLUMN public.profiles.has_password_set IS 'Indicates if user has set a password for classic email login';;
