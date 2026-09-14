const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const files = readdirSync('test').filter(name => /\.test\.(c?js)$/.test(name)).map(name => `test/${name}`);
const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: { ...process.env, CUEMAP_E2E: '1' } });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
