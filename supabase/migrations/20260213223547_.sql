
-- Policy 1: Host can insert recordings for their live session
CREATE POLICY "Host can insert recordings"
  ON public.live_recordings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_recordings.live_id
        AND ls.host_user_id = auth.uid()
    )
  );

-- Policy 2: Host can update their own recordings
CREATE POLICY "Host can update own recordings"
  ON public.live_recordings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_recordings.live_id
        AND ls.host_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM live_sessions ls
      WHERE ls.id = live_recordings.live_id
        AND ls.host_user_id = auth.uid()
    )
  );
;
