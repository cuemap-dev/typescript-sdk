const assert = require('node:assert/strict');
const { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { afterEach, test } = require('node:test');
const { EmbeddedCueMap } = require('../dist/embedded.js');

const servers = [];
const engines = [];
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(engines.splice(0).map((engine) => engine.stop()));
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function listen(body) {
  const server = createServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify(body));
  });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(predicate, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail('condition was not met before timeout');
}

test('attaches to an existing CueMap engine without claiming ownership', async () => {
  const url = await listen({ name: 'CueMap Rust Engine', version: '0.7.3' });
  const engine = await EmbeddedCueMap.start({ url });

  assert.equal(engine.url, url);
  assert.equal(engine.owned, false);
  await engine.stop();
});

test('attaches when an existing engine advertises every required capability', async () => {
  const url = await listen({
    name: 'CueMap Rust Engine',
    version: '0.7.3',
    capabilities: ['repository_ingestion_scope_v1'],
  });
  const engine = await EmbeddedCueMap.start({
    url,
    requiredCapabilities: ['repository_ingestion_scope_v1'],
  });

  assert.equal(engine.url, url);
  assert.equal(engine.owned, false);
  await engine.stop();
});

test('rejects an existing CueMap engine missing a required capability', async () => {
  const url = await listen({ name: 'CueMap Rust Engine', version: '0.7.3' });
  await assert.rejects(
    EmbeddedCueMap.start({
      url,
      requiredCapabilities: ['repository_ingestion_scope_v1'],
    }),
    /incompatible; missing capabilities: repository_ingestion_scope_v1/
  );
});

test('rejects an external URL that is not CueMap', async () => {
  const url = await listen({ name: 'Another Service' });
  await assert.rejects(EmbeddedCueMap.start({ url }), /No CueMap engine is reachable/);
});

test('starts an owned engine and appends its stdout and stderr to the configured log', {
  skip: process.platform === 'win32',
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'cuemap-embedded-'));
  temporaryDirectories.push(directory);
  const executable = join(directory, 'fake-cuemap');
  const logPath = join(directory, 'logs', 'server.log');
  writeFileSync(executable, `#!/usr/bin/env node
const { createServer } = require('node:http');
const portIndex = process.argv.indexOf('--port');
const port = Number(process.argv[portIndex + 1]);
process.stdout.write('fake snapshot stdout\\n');
process.stderr.write('fake snapshot stderr\\n');
const server = createServer((_request, response) => {
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify({ name: 'CueMap Rust Engine', capabilities: [] }));
});
server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
`);
  chmodSync(executable, 0o755);

  const engine = await EmbeddedCueMap.start({
    binPath: executable,
    port: await freePort(),
    logPath,
    startupTimeoutMs: 5_000,
  });
  engines.push(engine);

  assert.equal(engine.owned, true);
  await waitFor(() => existsSync(logPath) && readFileSync(logPath, 'utf8').includes('fake snapshot stderr'));
  const log = readFileSync(logPath, 'utf8');
  assert.match(log, /fake snapshot stdout/);
  assert.match(log, /fake snapshot stderr/);
});
