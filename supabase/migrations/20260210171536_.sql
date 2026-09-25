-- Tạo auth user giả cho Angel Bot
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, raw_app_meta_data, raw_user_meta_data)
VALUES (
  'a0000000-0000-0000-0000-000000a09e10'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  'angel-bot@funprofile.internal',
  '',
  now(),
  now(),
  now(),
  '',
  '{"provider":"system","providers":["system"]}'::jsonb,
  '{"is_bot":true}'::jsonb
);

-- Tạo profile cho Angel Bot
INSERT INTO profiles (id, username, full_name, avatar_url)
VALUES (
  'a0000000-0000-0000-0000-000000a09e10'::uuid,
  'angel_ai',
  'Angel AI',
  NULL
)
ON CONFLICT (id) DO NOTHING;;
