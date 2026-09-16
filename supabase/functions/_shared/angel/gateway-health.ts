// _shared/angel/gateway-health.ts
// TIER 2 (Step 2) — Lovable AI Gateway health tracker.
// Khi Gateway trả 402 / 403 credit_limit_reached, mark tạm "unavailable"
// trong 15 phút để `askAngel` KHÔNG gọi tiếp gây lỗi liên tục và tốn latency.
// Reset khi TTL hết hoặc admin gọi resetGatewayHealth().
//
// State chỉ in-process (per edge instance) — đủ tốt vì mỗi instance sẽ tự
// nhận 1 lần lỗi rồi quiesce. Không cần bảng DB.

const UNAVAILABLE_TTL_MS = 15 * 60_000;

interface HealthState {
  unavailable: boolean;
  reason: string | null;
  markedAt: number;
  expiresAt: number;
}

const state: HealthState = {
  unavailable: false,
  reason: null,
  markedAt: 0,
  expiresAt: 0,
};

export function markLovableUnavailable(reason: string, ttlMs = UNAVAILABLE_TTL_MS): void {
  const now = Date.now();
  state.unavailable = true;
  state.reason = reason.slice(0, 200);
  state.markedAt = now;
  state.expiresAt = now + ttlMs;
  console.warn(`[gateway-health] Lovable marked UNAVAILABLE reason="${state.reason}" ttl=${Math.round(ttlMs / 60_000)}min`);
}

export function isLovableUnavailable(): { unavailable: boolean; reason: string | null; remainingMs: number } {
  if (!state.unavailable) return { unavailable: false, reason: null, remainingMs: 0 };
  const remaining = state.expiresAt - Date.now();
  if (remaining <= 0) {
    state.unavailable = false;
    state.reason = null;
    state.markedAt = 0;
    state.expiresAt = 0;
    return { unavailable: false, reason: null, remainingMs: 0 };
  }
  return { unavailable: true, reason: state.reason, remainingMs: remaining };
}

export function resetGatewayHealth(): void {
  state.unavailable = false;
  state.reason = null;
  state.markedAt = 0;
  state.expiresAt = 0;
}

/** Trả về true nếu error là 402 / 403 kèm credit_limit_reached hoặc payment required. */
export function isLovableCreditError(status: number | undefined, detail: unknown): boolean {
  if (status !== 402 && status !== 403) return false;
  const str = typeof detail === "string" ? detail : JSON.stringify(detail ?? "");
  return /credit_limit_reached|payment\s*required|insufficient/i.test(str);
}
