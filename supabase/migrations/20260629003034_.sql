truncate table public.telegram_ai_response_cache;
update public.telegram_community_settings set ai_knowledge_version = coalesce(ai_knowledge_version, 0) + 1;;
