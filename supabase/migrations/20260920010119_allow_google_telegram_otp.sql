alter table public.telegram_otp_challenges
  drop constraint if exists telegram_otp_challenges_first_factor_check;

alter table public.telegram_otp_challenges
  add constraint telegram_otp_challenges_first_factor_check
  check (
    first_factor in ('email_otp', 'wallet', 'password', 'google')
  );
