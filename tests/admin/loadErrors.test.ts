import { expect, test } from 'bun:test';
// Keep backend module mocks isolated from the auth integration suites.
test('Telegram admin error-state UI regressions', () => {
  const result = Bun.spawnSync(['bun', 'test', './tests/admin/loadErrors.cases.tsx'], { cwd: process.cwd() });
  if (result.exitCode !== 0) console.error(result.stdout.toString(), result.stderr.toString());
  expect(result.exitCode).toBe(0);
}, 30_000);
