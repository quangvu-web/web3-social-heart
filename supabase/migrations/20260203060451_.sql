-- Enable realtime for chat tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;;
