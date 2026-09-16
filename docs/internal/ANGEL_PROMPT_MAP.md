# Angel AI — Prompt & Runtime Map

Bản đồ luồng chạy của bot Angel AI trong dự án FUN Profile. Dùng để onboard
người mới và tra nhanh "rule/prompt này nằm ở đâu, tắt ở đâu".

Cập nhật: Sprint 1 (Foundation).

---

## 1. Ingress (nơi request đi vào)

| Channel | Entry file | Ghi chú |
|---|---|---|
| Telegram DM / Group | `supabase/functions/telegram-community-webhook/index.ts` | Nhận update từ Telegram, forward vào `_shared/telegram-community.ts`. |
| Web DM (in-app chat) | `supabase/functions/angel-chat/index.ts` | Gọi từ `src/modules/chat/` qua `supabase.functions.invoke`. |
| Inline (Angel FAB) | `supabase/functions/angel-inline/index.ts` | Gọi từ hook `src/modules/chat/hooks/useAngelInline.ts`. |
| Image endpoint (DM/inline) | `supabase/functions/angel-image/index.ts` | Xác thực JWT user, forward `user.id` làm `user_ref`. |

Tất cả đều đi qua `_shared/` để dùng chung persona + guardrails.

---

## 2. Router intent (trong `_shared/telegram-community.ts` và web)

Thứ tự phát hiện trước khi call Angel gốc:

1. **Spam / anti-scam** (`telegram-community.ts` — mention-bait, CJK, payment laundering) → xoá + strike.
2. **Image intent** — `detectImageIntent()` ở `_shared/angel-image.ts` → generate-image / edit-image.
3. **YouTube link** — `_shared/angel-youtube-fetch.ts` → fetch transcript rồi ingest.
4. **Seeding context** — regex trong `_shared/angel-facts.ts` → giữ nguyên tên ví "FUN Profile Platform".
5. **Smart fallback** — `INTERPRET_AND_ANSWER_RULE` khi câu quá ngắn / mơ hồ.
6. **Factual clean-mirror** — bypass style pass, gọi thẳng mirror RAG.
7. **Default chat** — call `angel-router` (Angel gốc), có Transient Status Fallback về `angel-chat`.

---

## 3. Persona / rule blocks (đều ở `_shared/angel-facts.ts`)

Mỗi block có bản `DEFAULT_*` (hardcode) + được override qua bảng
`angel_persona_settings.rule_overrides` (JSON `{ block_key: string }`). UI admin
`AdminAngelPersonaTab.tsx` cho phép sửa.

- `WEB_PERSONA_PROMPT`
- `WEB_LANGUAGE_MIRROR_RULE`
- `PRONOUN_SUBJECT_RULE` — bot tự xưng "mình", gọi user là "bé"; "Angel" chỉ là tên riêng/định danh
- `NARRATIVE_CHARACTER_VOICE_RULE` — lời thoại nhân vật KHÔNG chèn "Angel"
- `RICH_FORMAT_RULE`
- `OFFICIAL_FACTS` — dữ liệu ví, link, chương trình
- `SCOPE_EXPANSION_RULE` — Open Scope
- `ANTI_HALLUCINATION_RULE`
- `RESPONSE_LENGTH_RULE` — ~100 từ mặc định, dài khi trigger
- `LIGHT_LANGUAGE_RULE`
- `SEEDING_CONTEXT_FIDELITY_RULE`
- `SEED_PHRASE_WARNING_DISCIPLINE_RULE`
- `WIT_AND_CHARM_RULE`
- `EMOTIONAL_ATTUNEMENT_RULE`
- `CALLBACK_MEMORY_RULE`

---

## 4. Post-process pipeline (`_shared/angel-postprocess.ts`)

Sau khi có response từ Angel gốc, có thể chạy các bước phụ (đều dùng
`gemini-3.1-flash-lite`):

| Bước | Kích hoạt | Ghi chú |
|---|---|---|
| Style pass | ENV `ANGEL_POSTPROCESS_STYLE_ENABLED` (default `false`) | Rút gọn + thêm emoji. Có thể phá detail → mặc định TẮT. |
| Narrative dialogue fix-up | ENV `ANGEL_NARRATIVE_FIXUP_ENABLED` | Sửa lời thoại nhân vật sai xưng hô. |
| Hard revert pairs | Luôn chạy (safety net regex) | `hòa Angel` → `hòa mình`, `bé bè` → `bạn bè`... |
| Pronoun Contract v2 | Luôn chạy, không tốn AI credit | Chuẩn hoá mọi output Telegram về `mình/bé`; bảo vệ tên riêng, URL, code, ví, handle và trích dẫn. |

---

## 5. Image pipeline (`_shared/angel-image.ts` + `angel-image-fallback.ts`)

**Kênh cho phép vẽ ảnh:** DM Telegram + web (AngelFAB/inline). **Group Telegram
bị chặn mặc định** — reply hướng dẫn bé nhắn riêng cho Angel; throttle 10
phút/user để không spam. Bật lại bằng flag `image.group_enabled` trong Admin UI
(tab Persona → Cấu hình vẽ ảnh).

3 tier:

- **P1 Angel gốc spiritual** (`generate-image` với `mode: "spiritual"`) — chất lượng cao, có lúc 500.
- **P2 Angel gốc fast** (`mode: "fast"`) — retry nếu P1 fail.
- **P3 Lovable AI Gateway** — Nano Banana 2 (fast) hoặc Pro (heavy prompt). Quota 5/ngày/user. Tốn credit FUN Profile.

Prompt heavy (>= 180 ký tự hoặc keyword logo/cosmos/design) → force P3 nếu P1/P2 fail và dùng `image_heavy` model.

---

## 6. Memory (`_shared/angel-memory.ts`)

- Trigger sau mỗi DM (nếu bật `memory.extract_on_dm`).
- Dùng `gemini-3.1-flash-lite` trích xuất fact → lưu `angel_user_memory`.
- Recall vào system prompt lần chat sau (`CALLBACK_MEMORY_RULE`).

---

## 7. Bảng DB liên quan

| Bảng | Mục đích |
|---|---|
| `angel_persona_settings` | Rule override từ admin UI. |
| `angel_memory_settings` | Global memory config. |
| `angel_user_memory` | Fact đã trích xuất per user. |
| `angel_watched_channels` | Telegram channel được ingest knowledge. |
| `angel_channel_knowledge` | Nội dung đã ingest. |
| `angel_web_chat_history` | Lịch sử chat web. |
| `angel_youtube_transcript_cache` | Cache transcript YouTube. |
| `angel_lovable_image_fallback_usage` | Quota Tier-3 image fallback. |
| **`angel_feature_flags`** *(Sprint 1)* | Bật/tắt tính năng runtime. |
| **`angel_ai_events`** *(Sprint 1)* | Telemetry mỗi call AI. |

---

## 8. Foundation modules mới (Sprint 1)

- `_shared/angel/models.ts` — Model registry (`MODELS.chat_primary`, `image_heavy`, ...).
- `_shared/angel/flags.ts` — `getFlag("router.smart_fallback", true)` với cache 60s.
- `_shared/angel/telemetry.ts` — `trackAi({...}, () => call())` để log tự động.

Sprint 2+ sẽ migrate các file cũ (`angel-image.ts`, `angel-postprocess.ts`,
`telegram-community.ts`) sang dùng 3 module này thay vì hardcode.

---

## 9. Sprint roadmap

Xem `.lovable/plan.md` (bản plan Cha đã duyệt).
