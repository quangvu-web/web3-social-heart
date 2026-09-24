import { expect, test } from 'bun:test';
// Isolate module mocks from the existing Google/Telegram integration suite.
for (const suite of ['emailOtp.ui.cases.tsx', 'emailOtp.edge.cases.ts', 'emailOtp.session.cases.ts']) {
  test(suite, () => {
    const result = Bun.spawnSync(['bun', 'test', `./tests/auth/${suite}`], { cwd: process.cwd() });
    if (result.exitCode !== 0) console.error(result.stdout.toString(), result.stderr.toString());
    expect(result.exitCode).toBe(0);
  });
}
