# Filling in the 11 missing settings

Goal: add the missing values the app's backend code reads, so email login, scheduled jobs, video upload/replay and live recording status all work on the new backend. No code changes are needed — only values.

All of these are entered in one place: the project's Secrets (they become available to the backend functions automatically). You do not add them in the Cloudflare, Agora or Telegram dashboards; you only *read* some of the values from there.

## Group A — copy the same value you already have (5 items)

These are alternate names the code also accepts. Each one already has a twin stored in this project, so the value is identical and can be reused from the original project safely.

| Name | Same value as | Used for | Required? |
|---|---|---|---|
| R2_BUCKET_NAME | R2_TEMP_BUCKET | Photo/video uploads and deletes | Required |
| CLOUDFLARE_R2_ENDPOINT | R2_ENDPOINT | Storage address for uploads | Required |
| R2_PUBLIC_DOMAIN | R2_PUBLIC_BASE_URL | Public link used to play stored videos | Required |
| CLOUDFLARE_STREAM_TOKEN | CLOUDFLARE_STREAM_API_TOKEN | Creating and finalising replay videos | Required |
| CLOUDFLARE_WEBHOOK_SECRET | CLOUDFLARE_STREAM_WEBHOOK_SECRET | Verifying "video ready" callbacks | Required |

Nothing to obtain — I read nothing secret; you paste the same values you already use, or I can note them as duplicates for you to fill in the secure form.

## Group B — must be newly created for this project (3 items)

Reusing the old values here is not recommended: they protect endpoints whose addresses changed with the new backend.

1. **CRON_SECRET** — password that lets the scheduled jobs (recording processing, replay archiving, live watchdog, meditation broadcast) call themselves. Any long random string. Newly generated. Required if you want scheduled jobs.
2. **SCHEDULED_FUNCTION_SECRET** — second accepted password for the same scheduled jobs; can be the same style of random string, generated fresh. Required alongside the above.
3. **EMAIL_OTP_HASH_SECRET** — protects the one-time email login links. Long random string, generated fresh. Required if email login is used; changing it only invalidates links already in flight.

I can create all three automatically as strong random values — nothing for you to look up.

## Group C — values you must supply or confirm (3 items)

1. **SITE_URL** — the public address of the site, used when Restream sends a user back after connecting. Value: your live site address (e.g. the published web address, or your custom domain when you have one). Not secret. Required only if Restream multistreaming is used.
2. **LIVE_AGORA_WORKER_URL** — the address of the separate Cloudflare Worker that reports live recording status. Found in your Cloudflare dashboard under Workers, as the worker's URL. Optional: only the "recording status" screen needs it.
3. **LIVE_AGORA_WORKER_API_KEY** — the access key for that same worker, the value you set as `API_KEY` when deploying it in Cloudflare. Optional, paired with the above. Reusable from the original project if the same worker is still in use.

## Not included (deliberately skipped)

The other unset names are optional switches with working defaults: Angel AI model/limit toggles (ANGEL_FAL_*, ANGEL_GEMINI_DIRECT_*, ANGEL_LOVABLE_FALLBACK_*, ANGEL_MODEL_VISION, ANGEL_AI_CHAT_URL, ANGEL_ROOT_BASE_URL and similar) and Agora tuning (AGORA_STORAGE_REGION, AGORA_RECORDING_MAX_IDLE_TIME, AGORA_RTMP_*). Leave them unset unless behaviour needs changing.

## Order of work, once approved

1. Generate the three Group B values automatically.
2. Open one secure form for Group A and Group C, so you paste the reused values and the two addresses in a single pass.
3. Re-check the full list and confirm nothing required is left empty.
4. Separately (outside this project), point the Telegram, Community Guard and Cloudflare Stream callbacks at the new backend addresses — I will give you the exact addresses to paste.

## Also worth updating at the same time

APP_URL, FUN_PROFILE_ORIGIN and RESTREAM_REDIRECT_URI still point at the original site and should be changed to the new address.
