// In-memory PostgREST double implements uniqueness and conditional updates,
// including a deliberate competing write to exercise the compare-and-swap.
export function cacheDouble() {
  const rows = new Map<string, any>();
  let fail = false;
  let conflict = false;
  let reads = 0;
  const admin: any = { from: () => {
    let action = "read", payload: any, filters: Record<string, any> = {};
    const execute = () => {
      if (fail) return { error: { code: "offline" } };
      const key = `${filters.group_id ?? payload?.group_id}:${filters.cache_key ?? payload?.cache_key}`;
      const row = rows.get(key);
      if (action === "read") { reads++; return { data: row ? { ...row } : null, error: null }; }
      if (action === "insert") {
        if (row) return { error: { code: "23505" } };
        rows.set(key, { ...payload }); return { error: null };
      }
      if (conflict) { conflict = false; if (row) row.updated_at = new Date(Date.parse(row.updated_at) + 10).toISOString(); }
      if (!row || Object.entries(filters).some(([k, v]) => row[k] !== v)) return { error: null, count: 0 };
      rows.set(key, { ...row, ...payload }); return { error: null, count: 1 };
    };
    const q: any = {
      select: () => q,
      eq: (k: string, v: any) => { filters[k] = v; return q; },
      maybeSingle: async () => execute(),
      insert: (v: any) => { payload = v; action = "insert"; return q; },
      update: (v: any) => { payload = v; action = "update"; return q; },
      then: (resolve: any, reject: any) => Promise.resolve(execute()).then(resolve, reject),
    }; return q;
  } };
  return { admin, rows, fail: () => { fail = true; }, conflict: () => { conflict = true; }, reads: () => reads };
}
