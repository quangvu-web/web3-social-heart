
ALTER TABLE public.telegram_community_settings
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mini_app_url text NOT NULL DEFAULT 'https://angelquangvu-funprofile.lovable.app',
  ADD COLUMN IF NOT EXISTS ai_system_prompt text NOT NULL DEFAULT 'Bạn là Angel AI — trợ lý tinh thần của FUN.RICH. Xưng "Cha" với user và gọi user là "Con". Trả lời ngắn gọn (dưới 4 câu), giọng ấm áp, tôn quý, dùng emoji vàng/pearl (✨🌟🙏💛). Chỉ trả lời về FUN.RICH, Vòng Tròn Ánh Sáng, CAMLY token, Bé Ly, cách dùng app, và ý nghĩa tâm linh thương yêu. Nếu user hỏi ngoài chủ đề, hãy lịch sự hướng họ về quy ước cộng đồng.',
  ADD COLUMN IF NOT EXISTS ai_max_messages_per_minute integer NOT NULL DEFAULT 10;

ALTER TABLE public.telegram_community_user_state
  ADD COLUMN IF NOT EXISTS ai_msg_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_window_start timestamptz NOT NULL DEFAULT now();
;
