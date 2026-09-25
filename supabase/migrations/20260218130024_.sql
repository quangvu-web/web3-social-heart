
-- Create live-thumbnails storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('live-thumbnails', 'live-thumbnails', true, 5242880, ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS: public read
CREATE POLICY "Live thumbnails are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'live-thumbnails');

-- RLS: authenticated users can upload
CREATE POLICY "Authenticated users can upload live thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'live-thumbnails');

-- RLS: users can update their own thumbnails
CREATE POLICY "Users can update their own live thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'live-thumbnails');
;
