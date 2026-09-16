# RTMP Origin

This origin accepts encoder input at:

```text
rtmp://live.camly.co/live/{stream_key}
```

It validates stream keys through the `live-rtmp` Supabase Edge Function, transcodes the RTMP input with FFmpeg, and serves HLS at:

```text
https://live.camly.co/hls/{stream_key}.m3u8
```

## Environment

Create `.env` next to `docker-compose.yml`:

```bash
SUPABASE_LIVE_RTMP_FUNCTION_URL=https://PROJECT_REF.functions.supabase.co/live-rtmp
RTMP_CALLBACK_SECRET=replace-with-the-same-secret-used-by-the-edge-function
```

The Edge Function needs:

```bash
RTMP_CALLBACK_SECRET=replace-with-the-same-secret
RTMP_STREAM_PASSWORD=replace-with-your-stream-password
RTMP_PUBLIC_BASE_URL=rtmp://live.camly.co/live
HLS_PUBLIC_BASE_URL=https://live.camly.co/hls
```

## Run

```bash
docker compose up -d --build
```

Put a CDN or reverse proxy in front of HTTP port `8080` for production playback. RTMP port `1935` should point directly at this origin or a TCP load balancer with sticky routing.

## Cleanup

Run this periodically from the container or host to delete stale HLS folders:

```bash
docker compose exec rtmp-origin cleanup-hls.sh
```
