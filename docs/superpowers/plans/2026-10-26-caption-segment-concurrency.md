# Caption segment concurrency implementation plan

**Goal:** Resolve accumulating caption latency using the user-provided measured diagnosis and exact requested scope.
**Architecture:** Four Promise.all workers dedupe and translate sentences with original previous-source context. Insert results in sentence order using unchanged playback and max-seq queries. Clear partial only after first successful insert. Memoize history and rows separately from partial updates.
**Spec:** User request dated 2026-10-26 (Malaysia Time).
**Constraints:** No migration/deployment/production changes; preserve existing mcp/index.ts edits, splitting, corrections, dedupe keys, seq calculation, summaries, playback and silence settings. Branch feature/caption-segment-concurrency. Use bun and deno separately.

- [x] Backend: regression tests with controlled deferred translations prove concurrency <=4, ordered inserts despite reversed completions, replay skips, partial retained until successful insert, playback/failure guards, and segment timing log. Run failing test, implement in angel-caption/index.ts, run deno caption tests.
- [x] Frontend: memoize CaptionHistory and CaptionRow in CaptionsPage.tsx; partial state stays outside history. Test reconciliation/render counts with 649/1001 lines, append and mode/size changes. Retain native scroll and recovery tests. No windowing without evidence requiring it.
- [ ] Acceptance: provide read-only latency bucket query/runbook and verify frontend bun test, Edge deno test, build, diff. Review and commit scoped files in Vietnamese, push feature branch; preview before any merge.

**Review focus:** Duplicate replays; previous-source context through duplicates; partial arriving during translation; playback changes before insertion; failed insert retains partial and emits timing. Real >=60 minute live acceptance and browser frame-time evidence must be recorded separately from synthetic tests; never infer production acceptance from unit tests.

Execution record: Backend 76/76 Deno tests; frontend 59/59 Bun tests; build succeeded. Independent review cleanup failure fixed RED→GREEN. 60-second Chrome fixture with 1001→1021 rows: p95 frame 17.6ms, max17.8ms, zero >34ms/longtasks, unchanged reader position. Real live baseline 771 rows captured with the exact requested formula; >=60-minute post-deployment acceptance remains pending. Read-only measurement script/runbook provided. Five entrypoint deno check errors reproduced on pre-change HEAD; bare Bun includes unsupported Deno tests (65 load errors), both reported in acceptance document.
