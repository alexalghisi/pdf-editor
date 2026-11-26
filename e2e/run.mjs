import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const suites = readdirSync(import.meta.dirname)
  .filter((file) => file.endsWith('.e2e.mjs'))
  .sort();

for (const suite of suites) {
  console.log(`\n${suite}`);
  const result = spawnSync(
    process.execPath,
    [join(import.meta.dirname, suite)],
    { stdio: 'inherit' },
  );
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
