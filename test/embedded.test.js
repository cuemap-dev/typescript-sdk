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
if (process.env.CUEMAP_API_KEY !== 'test-secret' || process.env.CUEMAP_HOST !== '127.0.0.1') process.exit(42);
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
    apiKey: 'test-secret',
    env: { CUEMAP_HOST: '0.0.0.0' },
    port: await freePort(),
    logPath,
    startupTimeoutMs: 15_000,
  }).catch(error => {
    error.message += `\nEngine log: ${existsSync(logPath) ? readFileSync(logPath, 'utf8') : 'missing'}`;
    throw error;
  });
  engines.push(engine);

  assert.equal(engine.owned, true);
  await waitFor(() => existsSync(logPath) && readFileSync(logPath, 'utf8').includes('fake snapshot stderr'));
  const log = readFileSync(logPath, 'utf8');
  assert.match(log, /fake snapshot stdout/);
  assert.match(log, /fake snapshot stderr/);
});


test('HTTPS attachment uses the TLS transport', async (context) => {
  const https = require('node:https');
  const { EventEmitter } = require('node:events');
  let requestedUrl;
  context.mock.method(https, 'get', (url, options, callback) => {
    requestedUrl = url;
    assert.equal(options.headers['X-API-Key'], 'tls-test-key');
    const request = new EventEmitter();
    request.setTimeout = () => request;
    process.nextTick(() => {
      const response = new EventEmitter();
      response.setEncoding = () => {};
      response.statusCode = 200;
      callback(response);
      response.emit('data', JSON.stringify({ name: 'CueMap Rust Engine' }));
      response.emit('end');
    });
    return request;
  });
  const engine = await EmbeddedCueMap.start({ url: 'https://localhost:8735', apiKey: 'tls-test-key' });
  assert.equal(requestedUrl, 'https://localhost:8735/');
  assert.equal(engine.owned, false);
});

test('Windows global npm installation resolves its native executable', () => {
  const { mkdirSync } = require('node:fs');
  const { resolveCueMapBinary } = require('../dist/embedded.js');
  const directory = mkdtempSync(join(tmpdir(), 'cuemap-windows-npm-'));
  temporaryDirectories.push(directory);
  const packageBin = join(directory, 'node_modules', '@cuemap-dev', 'engine-win32-x64', 'bin');
  mkdirSync(packageBin, { recursive: true });
  const native = join(packageBin, 'cuemap-native.exe');
  writeFileSync(native, 'test fixture');
  const platform = Object.getOwnPropertyDescriptor(process, 'platform');
  const arch = Object.getOwnPropertyDescriptor(process, 'arch');
  const oldPath = process.env.PATH;
  const oldBin = process.env.CUEMAP_BIN;
  try {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    Object.defineProperty(process, 'arch', { value: 'x64' });
    process.env.PATH = directory;
    delete process.env.CUEMAP_BIN;
    assert.equal(resolveCueMapBinary(), native);
  } finally {
    Object.defineProperty(process, 'platform', platform);
    Object.defineProperty(process, 'arch', arch);
    if (oldPath === undefined) delete process.env.PATH; else process.env.PATH = oldPath;
    if (oldBin === undefined) delete process.env.CUEMAP_BIN; else process.env.CUEMAP_BIN = oldBin;
  }
});
