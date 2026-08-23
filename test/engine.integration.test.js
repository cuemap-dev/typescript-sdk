const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const CueMap = require('../dist/index.js').default;
const { EmbeddedCueMap } = require('../dist/embedded.js');

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolvePromise, reject) => server.close((error) => error ? reject(error) : resolvePromise()));
  return port;
}

test('runs the SDK contract against a real release engine', {
  skip: process.env.CUEMAP_E2E !== '1',
}, async (context) => {
  const dataDir = mkdtempSync(join(tmpdir(), 'cuemap-ts-e2e-data-'));
  const port = await freePort();
  const binPath = process.env.CUEMAP_E2E_BIN || resolve(__dirname, '../../rust_engine/target/release/cuemap');
  const projectId = `ts-e2e-${process.pid}`;
  let engine;

  context.after(async () => {
    await engine?.stop();
    rmSync(dataDir, { recursive: true, force: true });
  });

  engine = await EmbeddedCueMap.start({
    binPath,
    port,
    logPath: false,
    startupTimeoutMs: 30_000,
    env: {
      CUEMAP_DATA_DIR: dataDir,
      CUEMAP_SEMANTIC_ENCODER_ENABLED: 'false',
      CUEMAP_SNAPSHOT_INTERVAL_SECONDS: '3600',
    },
  });

  const client = new CueMap({ url: engine.url, projectId });
  const memoryId = await client.add(
    'On 2026-08-18 we chose Postgres for the billing migration.',
    ['billing', 'postgres', 'decision'],
    { source: 'sdk-e2e' },
    true,
    { sourceKey: 'sdk-e2e:billing-choice', eventTime: 1_755_504_000 },
  );

  const recall = await client.recall({
    query_text: 'What database did we choose for the billing migration?',
    cues: ['billing', 'postgres'],
    semantic_mode: 'lexical',
    limit: 5,
    auto_reinforce: false,
  });
  assert.ok(Array.isArray(recall.results));
  assert.ok(recall.results.some((item) => String(item.memory_id) === String(memoryId)));

  const exported = await client.exportProject(projectId, {
    includeContent: true,
    includeCues: true,
    includeMetadata: true,
  });
  assert.ok(exported.memories.some((item) => String(item.id) === String(memoryId)));

  await engine.stop();
  engine = await EmbeddedCueMap.start({
    binPath,
    port,
    logPath: false,
    startupTimeoutMs: 30_000,
    env: {
      CUEMAP_DATA_DIR: dataDir,
      CUEMAP_SEMANTIC_ENCODER_ENABLED: 'false',
      CUEMAP_SNAPSHOT_INTERVAL_SECONDS: '3600',
    },
  });
  const restored = await new CueMap({ url: engine.url, projectId }).recall({
    cues: ['billing', 'postgres'],
    semantic_mode: 'lexical',
    limit: 5,
  });
  assert.ok(restored.results.some((item) => String(item.memory_id) === String(memoryId)));

  const isolated = new CueMap({ url: engine.url, projectId: `${projectId}-other` });
  const isolatedRecall = await isolated.recall({
    query_text: 'What database did we choose for the billing migration?',
    semantic_mode: 'lexical',
    limit: 5,
  });
  assert.deepEqual(isolatedRecall.results, []);
});
