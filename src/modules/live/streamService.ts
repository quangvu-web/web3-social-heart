import { supabase } from '@/integrations/supabase/client';
import { uploadVideoToR2 } from '@/utils/r2Upload';

const db = supabase as any;

export async function uploadStreamVideo(blob: Blob, userId: string) {
  const file = new File([blob], `${Date.now()}.webm`, { type: 'video/webm' });
  const result = await uploadVideoToR2(file);
  return { publicUrl: result.publicUrl, key: result.key };
}

export async function createStreamRecord(
  userId: string,
  title: string | null,
  publicUrl: string,
  duration: number
) {
  const { data: stream, error: streamError } = await db
    .from('streams')
    .insert({
      user_id: userId,
      title: title || 'Live Video',
      video_path: publicUrl,
      duration,
      status: 'completed',
    })
    .select('id')
    .single();

  if (streamError) throw streamError;

  await db.from('posts').insert({
    user_id: userId,
    content: title || 'Live Video',
    video_url: publicUrl,
    visibility: 'public',
    post_type: 'video',
  });

  return stream;
}
