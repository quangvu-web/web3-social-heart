TRUNCATE TABLE public.telegram_ai_response_cache;
UPDATE public.telegram_community_settings SET ai_knowledge_version = COALESCE(ai_knowledge_version, 0) + 1;;
