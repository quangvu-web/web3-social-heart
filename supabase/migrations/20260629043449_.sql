ALTER TABLE public.telegram_community_settings
ADD COLUMN IF NOT EXISTS ai_mirror_angel_web boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.telegram_community_settings.ai_mirror_angel_web IS
'Khi true (mặc định): Pass 1 funcore gửi user-only, mirror Angel web chính chủ để RAG hit đúng knowledge. Tắt để fallback chèn personaPrompt như cũ.';;
