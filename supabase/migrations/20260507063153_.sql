
CREATE POLICY "Host can delete own live sessions"
ON public.live_sessions FOR DELETE
USING (auth.uid() = host_user_id OR auth.uid() = owner_id);

CREATE POLICY "Owners and admins can delete replays"
ON public.live_replays FOR DELETE
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.live_sessions
  DROP CONSTRAINT live_sessions_post_id_fkey,
  ADD CONSTRAINT live_sessions_post_id_fkey
    FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE SET NULL;
;
