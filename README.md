# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/f06fbccb-088c-4170-8736-4f1a09d4d572

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/f06fbccb-088c-4170-8736-4f1a09d4d572) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/f06fbccb-088c-4170-8736-4f1a09d4d572) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

“Test sync ngược 12/11/2025”
"Test 16 Nov 2025"
echo "# fixed lock file $(date)" >> README.md

## Fun Chat Package

- Package source: `packages/fun-chat`
- Demo app: `examples/vite-demo`

Commands:

```sh
npm run build:fun-chat
npm run pack:fun-chat
```

## Wallet (Android PWA + MetaMask)

Required env vars:

- `VITE_WALLETCONNECT_PROJECT_ID` (required for mobile deep-link connectors)
- `VITE_BSC_RPC_URL` (optional, defaults to `https://bsc-dataseed.binance.org`)
- `VITE_ZEROX_API_BASE_URL` (optional, defaults to `https://bsc.api.0x.org`)
- `VITE_ZEROX_API_KEY` (optional, recommended if you need higher 0x API rate limit)
- `VITE_MOONPAY_BASE_URL` (optional, defaults to `https://buy.moonpay.com`)
- `VITE_MOONPAY_API_KEY` (optional, recommended for MoonPay production setup)

Behavior:

- If `VITE_WALLETCONNECT_PROJECT_ID` is missing, WalletConnect-based mobile connectors are disabled gracefully.
- Wallet network status is checked via RPC `eth_chainId` (normalized), not `networkVersion`.
- Supported wallet chains for status check: `56` (BSC Mainnet) and `97` (BSC Testnet).
- If chain is unsupported, UI shows `Wrong network` and user can tap `Switch Network` (`wallet_switchEthereumChain` with `wallet_addEthereumChain` fallback).
- Wallet send flow supports `BNB`, `USDT`, `BTCB`, `CAMLY`, `FUN` in the dropdown.
- `FUN` currently shows as `Testnet - dang trien khai` and send is intentionally disabled for now.
- In wallet token list, tapping a token row opens send dialog with that token preselected.
- For normal wallet-to-wallet token send, app uses ERC-20 `transfer` directly (`approve` is not required).
- Wallet swap is native in-app (0x aggregator) on BSC Mainnet only (`chainId=56`), no platform fee in phase 1.
- Swap flow: quote -> approve (if required) -> swap -> wait for confirmation -> refresh balances.
- `FUN` is visible in swap token list for roadmap but swap is disabled while implementation is in progress.
- Wallet buy uses MoonPay deep-link/new-tab flow with Visa support.
- Buy guard: wallet must be connected and network must be BSC Mainnet (`56`).
- Buy phase 1 token prefill: `BNB`, `USDT`.

Network resolve fallback:

- If wallet is connected but chain cannot be resolved yet, UI shows `Network issue` with `Refresh Network`.
- In Android PWA, guidance is `Refresh` or `Disconnect -> Connect` from wallet app.
- DEV mode shows a debug toast for unresolved chain; production hides debug toast and keeps user-facing fallback only.

Mobile smoothness policy:

- No auto-switch chain right after connect (soft-only flow).
- User explicitly taps `Switch Network` when chain is unsupported.
- Connect/disconnect actions include anti-spam guards to avoid double-tap race conditions on mobile.
- If PWA deeplink return is unstable, troubleshoot in this order: force close wallet app -> reopen PWA -> disconnect/reconnect wallet.

Android PWA checklist:

1. Install PWA on Android and open `/wallet`.
2. Tap `Connect Wallet` and choose MetaMask in RainbowKit.
3. Approve connection in MetaMask app, return to PWA.
4. If wallet is on wrong chain, use `Switch Network` button to move to BNB Smart Chain.
5. Verify link/sign flow succeeds in wallet settings and wallet login.
6. If `Network issue` appears after deep-link return, tap `Refresh Network`; if still failing, disconnect and reconnect from wallet app.
7. Test send flow with BNB/USDT/BTCB/CAMLY and verify FUN shows in dropdown as testnet-in-progress and cannot be sent yet.

Send troubleshooting:

- Wrong network: switch to BNB Smart Chain then retry send.
- Insufficient gas: ensure wallet has enough BNB for gas (including token transfer).
- User rejected signature: reopen wallet and retry from `Gui`.
- Pending too long / RPC timeout: keep tx hash, refresh status, and retry later if needed.

## Unified Auth + Wallet Linking (Supabase)

### Security rules

- Never expose `SUPABASE_SERVICE_ROLE_KEY` in frontend code.
- Use edge functions for privileged wallet verification and nonce management.
- Keep RLS enabled on `user_wallets`.

### Required edge function secrets

Set in Supabase project secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### New edge functions

- `wallet-nonce`
- `wallet-link`
- `wallet-login`
- `me-unified`
- `siwe-nonce`
- `siwe-verify`
- `email-link-start`
- `email-link-verify`

Deploy:

```sh
supabase functions deploy wallet-nonce
supabase functions deploy wallet-link
supabase functions deploy wallet-login
supabase functions deploy wallet-verify
supabase functions deploy me-unified
supabase functions deploy siwe-nonce
supabase functions deploy siwe-verify
supabase functions deploy email-link-start
supabase functions deploy email-link-verify
supabase functions deploy connect-external-wallet
supabase functions deploy disconnect-external-wallet
```

### Wallet-first onboarding env vars

Required Supabase function secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY` (for email OTP delivery in `email-link-start`)
- `EMAIL_OTP_HASH_SECRET` (hash key for OTP verification in `email-link-verify`)

Do not expose any of these secrets in frontend code.

### Frontend integration

- Link flow: `wallet-nonce (purpose=link)` -> `personal_sign` -> `wallet-link`.
- Wallet-first login flow: `siwe-nonce` -> `personal_sign` -> `siwe-verify` -> `supabase.auth.verifyOtp({ token_hash, type: "email" })`.
- Email verify upgrade flow: `email-link-start` -> OTP email -> `email-link-verify` (updates `auth.users.email` and profile trust state).
- Backward-compatible login flow: `wallet-nonce (purpose=login)` -> `personal_sign` -> `wallet-login` -> `supabase.auth.verifyOtp({ token_hash, type: "email" })`.
- When user is authenticated, `supabase.functions.invoke` automatically includes Authorization JWT.
