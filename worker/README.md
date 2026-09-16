# Fun Agora RTC Token Service

## Cloud Recording env (required)

Set these secrets for `/recording/acquire|start|stop|query`:

- `AGORA_APP_ID`
- `AGORA_CUSTOMER_ID`
- `AGORA_CUSTOMER_SECRET`
- `API_KEY`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_REGION`
- `R2_ENDPOINT` (e.g. `https://<accountid>.r2.cloudflarestorage.com`)
- `RECORDING_PLAYBACK_BASE_URL`

Cloudflare Worker để generate Agora RTC tokens cho ứng dụng Fun Profile.

## 🚀 Quick Start

### 1. Cài đặt dependencies

```bash
cd worker
npm install
```

### 2. Cấu hình Secrets

```bash
# Agora credentials (lấy từ Agora Console)
wrangler secret put AGORA_APP_ID
# Nhập App ID khi được hỏi

wrangler secret put AGORA_APP_CERTIFICATE
# Nhập App Certificate khi được hỏi

# API key để bảo vệ endpoint (tạo một key mạnh 32+ ký tự)
wrangler secret put API_KEY
# Nhập API key khi được hỏi
```

### 3. Local Development

```bash
npm run dev
```

Worker sẽ chạy tại `http://localhost:8787`

### 4. Deploy to Production

```bash
npm run deploy
```

Worker sẽ được deploy tại: `https://fun-agora-rtc-token.<your-subdomain>.workers.dev`

---

## 📡 API Reference

### GET /health

Health check endpoint.

**Response:**
```json
{
  "ok": true,
  "service": "fun-agora-rtc-token",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET /config

Trả về public configuration (không bao gồm secrets).

**Response:**
```json
{
  "appId": "your_app_id",
  "allowedOrigin": "https://angelquangvu-funprofile.lovable.app",
  "defaultTtlSeconds": 3600
}
```

### POST /token/rtc

Generate RTC token cho Agora Video Calling.

**Headers:**
```
Content-Type: application/json
x-api-key: <YOUR_API_KEY>
```

**Request Body:**
```json
{
  "channel": "my-channel",
  "userAccount": "user-123",
  "role": "publisher",
  "expireSeconds": 3600
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| channel | string | Yes | Channel name (1-64 chars, alphanumeric, _, -) |
| userAccount | string | Yes | User account/UID (1-128 chars) |
| role | string | No | "publisher" (default) or "subscriber" |
| expireSeconds | number | No | Token TTL in seconds (60-86400, default: 3600) |

**Success Response (200):**
```json
{
  "appId": "your_app_id",
  "token": "007eJxTYBBx...",
  "channel": "my-channel",
  "userAccount": "user-123",
  "role": "publisher",
  "expireAt": 1705316400
}
```

**Error Responses:**

| Status | Description |
|--------|-------------|
| 400 | Invalid request (missing/invalid fields) |
| 401 | Missing or invalid API key |
| 403 | Origin not allowed |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 🔌 Frontend Integration

### Trong Lovable App (React/TypeScript)

```typescript
// src/utils/agoraToken.ts

const AGORA_WORKER_URL = 'https://fun-agora-rtc-token.<your-subdomain>.workers.dev';
const API_KEY = import.meta.env.VITE_AGORA_WORKER_API_KEY; // Lưu trong .env

export interface AgoraTokenResponse {
  appId: string;
  token: string;
  channel: string;
  userAccount: string;
  role: string;
  expireAt: number;
}

export async function getAgoraToken(
  channel: string,
  userAccount: string,
  role: 'publisher' | 'subscriber' = 'publisher'
): Promise<AgoraTokenResponse> {
  const response = await fetch(`${AGORA_WORKER_URL}/token/rtc`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({
      channel,
      userAccount,
      role,
      expireSeconds: 3600,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get Agora token');
  }

  return response.json();
}
```

### Sử dụng với Agora Web SDK

```typescript
import AgoraRTC from 'agora-rtc-sdk-ng';
import { getAgoraToken } from './utils/agoraToken';

async function joinChannel(channelName: string, userId: string) {
  // 1. Get token from worker
  const { appId, token, userAccount } = await getAgoraToken(channelName, userId);

  // 2. Create Agora client
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  // 3. Join channel with string userAccount
  await client.join(appId, channelName, token, userAccount);

  // 4. Create and publish tracks
  const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
  await client.publish([audioTrack, videoTrack]);

  console.log('Joined channel successfully!');
}
```

---

## 🔒 Security

### CORS
- Chỉ cho phép requests từ: `https://angelquangvu-funprofile.lovable.app`

### API Key
- Bắt buộc header `x-api-key` cho endpoint `/token/rtc`
- Khuyến nghị: Sử dụng key mạnh (32+ ký tự random)

### Rate Limiting
- Best-effort in-memory rate limit: 60 requests/minute per IP
- **Production**: Nên enable Cloudflare Rate Limiting Rules

### Secrets
- `AGORA_APP_CERTIFICATE` không bao giờ được trả về cho client
- Chỉ lưu trữ trong Cloudflare Secrets

---

## 🛠 Configuration

### wrangler.toml

| Variable | Description |
|----------|-------------|
| ALLOWED_ORIGIN | Domain được phép gọi API |
| TOKEN_TTL_SECONDS | Default TTL cho token (giây) |

### Secrets (wrangler secret put)

| Secret | Description |
|--------|-------------|
| AGORA_APP_ID | Agora Application ID |
| AGORA_APP_CERTIFICATE | Agora App Certificate |
| API_KEY | API key để authenticate requests |

---

## 📊 Monitoring

### View Logs

```bash
npm run tail
```

### Metrics

Truy cập Cloudflare Dashboard > Workers & Pages > fun-agora-rtc-token > Metrics

---

## 🧪 Testing with cURL

### Health Check
```bash
curl https://fun-agora-rtc-token.<subdomain>.workers.dev/health
```

### Get Config
```bash
curl https://fun-agora-rtc-token.<subdomain>.workers.dev/config
```

### Generate Token
```bash
curl -X POST https://fun-agora-rtc-token.<subdomain>.workers.dev/token/rtc \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Origin: https://angelquangvu-funprofile.lovable.app" \
  -d '{
    "channel": "test-channel",
    "userAccount": "user-123",
    "role": "publisher",
    "expireSeconds": 3600
  }'
```

---

## 📝 License

Private - Fun Profile Team
