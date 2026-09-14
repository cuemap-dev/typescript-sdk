const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');

const files = readdirSync('test')
  .filter((name) => /\.test\.js$/.test(name))
  .sort()
  .map((name) => `test/${name}`);

if (files.length === 0) {
  throw new Error('No test files found in test/');
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
