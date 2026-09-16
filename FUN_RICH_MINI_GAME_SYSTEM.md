# FUN.Rich Mini Game System

## Product Vision

FUN Play is the mini-game layer for FUN Profile / FUN.Rich. The goal is simple:
free to join, free to use, earn together, and reward positive community behavior.

The MVP should start with Daily Light Quest and a server-side reward ledger. Treasure
Hunt, AI Companion Pet, and Mystery Box can then reuse the same reward, anti-cheat,
inventory, and leaderboard foundation.

## Recommended MVP Order

1. Daily Light Quest
   - 3-7 daily missions.
   - Streak, XP, Light Score, and reward claim.
   - AI moderation for comments/posts before reward approval.

2. Reward Ledger
   - Every reward has an idempotency key.
   - Rewards can be pending, approved, rejected, or paid.
   - Camly Coin and NFT rewards should stay pending until risk checks pass.

3. Light Score
   - Non-transferable reputation score.
   - Positive behavior increases score.
   - Spam, abuse, bot signals, and rejected moderation reduce trust.

4. Mystery Box
   - Server-side probability table.
   - Seasonal box types.
   - Jackpot budget and rarity caps.

5. AI Pet and Treasure Hunt
   - Pet uses quest and reward events.
   - Treasure Hunt uses event, QR, geo, and team proof checks.

## Core Game Loops

### Daily Light Quest

User opens FUN Play, receives a daily bundle, completes positive actions, then claims
FUN Money, XP, Light Score, Camly Coin, NFT badge, or Mystery Box.

Anti-cheat:
- Daily caps per mission.
- Cooldown between repeated actions.
- AI sentiment checks for comments and posts.
- Reward pending state for risky activity.

### Treasure Hunt

Admin creates a limited-time event with digital clues, QR codes, maps, or community
puzzles. Users submit proof, join teams, and compete on the leaderboard.

Anti-cheat:
- One claim per event per user.
- QR nonce hash and expiry.
- Geo confidence score.
- Device velocity and referral graph review.

### AI Companion Pet

Every user gets a Light Pet with level, energy, mood, aura, rarity, and skills. The pet
adds earning multipliers only after anti-inflation caps are applied.

Retention:
- Daily care.
- Evolution.
- Co-op missions.
- NFT skins and marketplace later.

### Mystery Box

Boxes come from login, quests, referrals, events, streaks, achievements, and social
contribution.

Economy rules:
- Client never decides reward outcome.
- Probability table is stored server-side.
- Jackpot budget is capped.
- Rare rewards can require manual or automated fraud review.

## Architecture

Client:
- React PWA page at `/fun-play`.
- Telegram Mini App compatible layout.
- WalletConnect and QR scan can be added later.

Game API:
- Quest assignment.
- Progress tracking.
- Claim reward.
- Open box.
- Pet action.
- Treasure claim.

Trust Layer:
- AI moderation.
- Device fingerprint.
- Rate limits.
- Risk score.
- Manual review queue.

Reward Engine:
- Idempotent reward ledger.
- Treasury budgets.
- Daily caps.
- Rarity rules.
- Pending/approved/paid lifecycle.

Data Layer:
- Supabase Postgres.
- RLS for user-owned data.
- Admin/service-role functions for sensitive writes.
- Analytics events for balancing.

Web3 Layer:
- BNB Chain.
- WalletConnect.
- Custodial and non-custodial wallet paths.
- NFT badge/item minting.
- Camly Coin distribution after approval.

## Database

Migration added:

`supabase/migrations/20260514183000_fun_rich_mini_game_system.sql`

Main tables:
- `fun_game_profiles`
- `fun_game_quest_templates`
- `fun_game_daily_quests`
- `fun_game_reward_ledger`
- `fun_game_treasure_events`
- `fun_game_treasure_claims`
- `fun_game_pets`
- `fun_game_box_types`
- `fun_game_user_boxes`
- `fun_game_inventory_items`
- `fun_game_anti_cheat_events`

## API Design

Suggested Supabase Edge Functions:

- `fun-game-daily-assign`
  - Creates 3-7 daily quests for the signed-in user.

- `fun-game-track-action`
  - Receives verified server events such as post created, positive comment approved,
    meditation completed, mini-game completed, or friend invited.

- `fun-game-claim-reward`
  - Checks quest completion, cooldown, cap, risk score, and idempotency key.

- `fun-game-open-box`
  - Uses server seed, client seed, nonce, and probability table to create a reward.

- `fun-game-pet-action`
  - Updates pet energy, mood, XP, and skill progression.

- `fun-game-treasure-claim`
  - Validates answer hash, QR nonce, geo confidence, team constraints, and event limits.

## Investor-Ready Positioning

FUN Play turns FUN Profile from a social app into a positive social economy. The first
MVP improves retention with daily quests. The reward ledger prepares the system for
Camly Coin, NFTs, and BNB Chain payouts without creating uncontrolled inflation. The
anti-cheat layer makes the platform safer before large-scale rewards are distributed.

## Future Roadmap

MVP 1:
- Daily Light Quest
- Reward Ledger
- Light Score
- Basic leaderboard

MVP 2:
- Mystery Box
- AI Companion Pet
- Inventory
- NFT badge metadata

MVP 3:
- Treasure Hunt
- QR scan
- Team events
- Viral share cards

Scale:
- Telegram Mini App
- On-chain Camly Coin payouts
- NFT marketplace
- Staking compatibility
- Fraud analytics dashboard
