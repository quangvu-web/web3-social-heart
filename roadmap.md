# Roadmap

## Open tasks
1. Update values of the 69 remixed secrets (AGORA_*, TELEGRAM_*, R2_*, etc.) — paused: user declined the bulk secure forms. Secrets already exist with carried-over values; confirm whether any actually need new values.
2. Missing frontend setting reported (optional): `VITE_WALLETCONNECT_PROJECT_ID` — WalletConnect mobile deep links stay disabled until it is provided.

## Done
- Verified external Supabase project `funprofile-production` (ref xoiceivuqbxnmpfdiklg) is connected and the frontend `.env` points at it.
- Produced the per-platform secret name inventory (Edge Functions / Cloudflare Worker / frontend VITE).
- Fixed the "Không thể tải FUN Profile" crash: duplicate realtime channel topics shared across simultaneously mounted hooks.
