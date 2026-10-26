// Read-only public caption measurement. Run from the repository root with Bun.
import { createClient } from "@supabase/supabase-js";

const publicCode = process.argv[2];
if (!publicCode || !/^[a-zA-Z0-9_-]+$/.test(publicCode)) {
  throw new Error("Usage: bun scripts/measure-caption-latency.ts PUBLIC_CODE [PHASE]");
}
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing public frontend backend configuration");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: session, error: sessionError } = await db.from("caption_sessions")
  .select("id,status,started_at").eq("public_code", publicCode).maybeSingle();
if (sessionError || !session?.started_at) {
  console.error({ error: "Session public read or start time unavailable", code: sessionError?.code });
  process.exit(1);
}

type Row = { id: string; seq: number; created_at: string; ts_offset_sec: number | null };
const rows: Row[] = [];
for (let page = 0; ; page++) {
  const { data, error } = await db.from("caption_lines").select("id,seq,created_at,ts_offset_sec")
    .eq("session_id", session.id).order("seq").order("id").range(page * 1000, (page + 1) * 1000 - 1);
  if (error) {
    console.error({ error: "Caption public read failed", code: error.code });
    process.exit(1);
  }
  rows.push(...data);
  if (data.length < 1000) break;
}
const median = (values: number[]) => {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2) : null;
};
const buckets = new Map<number, { latency: number[]; gaps: number[] }>();
rows.forEach((row, i) => {
  if (row.ts_offset_sec == null) return;
  const minute = Math.floor(Number(row.ts_offset_sec) / 600) * 10;
  const bucket = buckets.get(minute) ?? { latency: [], gaps: [] };
  bucket.latency.push((Date.parse(row.created_at) - Date.parse(session.started_at)) / 1000 - Number(row.ts_offset_sec));
  if (i) bucket.gaps.push((Date.parse(row.created_at) - Date.parse(rows[i - 1].created_at)) / 1000);
  buckets.set(minute, bucket);
});
const gaps = (subset: Row[]) => subset.slice(1)
  .map((row, i) => (Date.parse(row.created_at) - Date.parse(subset[i].created_at)) / 1000);
const myt = (date: Date) => `${date.toLocaleString("sv-SE", { timeZone: "Asia/Kuala_Lumpur" })} UTC+8`;
console.log(JSON.stringify({
  measured_at_myt: myt(new Date()),
  phase: process.argv[3] ?? "unclassified",
  public_code: publicCode,
  status: session.status,
  count: rows.length,
  last_insert_myt: rows.length ? myt(new Date(rows.at(-1)!.created_at)) : null,
  source_minutes: rows.length ? Math.max(...rows.map(row => Number(row.ts_offset_sec))) / 60 : null,
  first100_gap_median_sec: median(gaps(rows.slice(0, 100))),
  last100_gap_median_sec: median(gaps(rows.slice(-100))),
  duplicate_seq: rows.length - new Set(rows.map(row => row.seq)).size,
  buckets: Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]).map(([minute, bucket]) => ({
    minute, count: bucket.latency.length, latency_median_sec: median(bucket.latency),
    latency_max_sec: Math.max(...bucket.latency), gap_median_sec: median(bucket.gaps),
  })),
}, null, 2));
