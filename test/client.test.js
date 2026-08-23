const assert = require('node:assert/strict');
const test = require('node:test');
const CueMap = require('../dist/index.js').default;

test('add sends source key and original event time', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: 9 }),
    };
  };

  const client = new CueMap({ projectId: 'openclaw-main' });
  const id = await client.add('Historical message', [], undefined, false, {
    sourceKey: 'openclaw:session-1:message-1',
    eventTime: 1_704_067_200.25,
  });

  assert.equal(id, 9);
  assert.equal(body.source_key, 'openclaw:session-1:message-1');
  assert.equal(body.event_time, 1_704_067_200.25);
});

test('repository scope preview and apply preserve selected paths', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, method: options.method, body: options.body ? JSON.parse(options.body) : undefined });
    return {
      ok: true,
      json: async () => ({ status: 'ok' }),
    };
  };

  const client = new CueMap({ projectId: 'repo-my-app-a1b2c3d4e5' });
  await client.previewDirectory('/work/my-app', ['src']);
  await client.setProjectWatchDir(
    'repo-my-app-a1b2c3d4e5',
    '/work/my-app',
    ['dist/**'],
    ['map'],
    ['src', 'README.md'],
  );
  await client.getProjectWatchDir('repo-my-app-a1b2c3d4e5');

  assert.match(requests[0].url, /\/ingest\/directory\/preview$/);
  assert.deepEqual(requests[0].body.included_paths, ['src']);
  assert.match(requests[1].url, /\/projects\/repo-my-app-a1b2c3d4e5\/watch-dir$/);
  assert.deepEqual(requests[1].body, {
    watch_dir: '/work/my-app',
    included_paths: ['src', 'README.md'],
    ignored_patterns: ['dist/**'],
    ignored_extensions: ['map'],
  });
  assert.equal(requests[2].method, 'GET');
});

test('recall sends v0.7.2 semantic controls', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ results: [] }),
    };
  };

  const client = new CueMap({ projectId: 'semantic-test' });
  await client.recall({
    query_text: 'What did Kaan say about the bark?',
    limit: 20,
    semantic_mode: 'hybrid',
    query_embedding: [0.1, 0.2, 0.3],
  });

  assert.equal(body.semantic_mode, 'hybrid');
  assert.deepEqual(body.query_embedding, [0.1, 0.2, 0.3]);
});

test('intent classification and chunk embeddings match the engine schema', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, body: options.body ? JSON.parse(options.body) : undefined });
    return {
      ok: true,
      json: async () => ({ primary_intent: 'decision' }),
    };
  };

  const client = new CueMap({ projectId: 'intent-test' });
  const classification = await client.classifyIntent('What did we decide?', 'query');
  await client.ingestContent('First chunk. Second chunk.', 'notes.txt', {
    embeddings: [[0.1, 0.2], [0.3, 0.4]],
  });

  assert.equal(classification.primary_intent, 'decision');
  assert.match(requests[0].url, /\/intent\/classify$/);
  assert.deepEqual(requests[0].body, { text: 'What did we decide?', target: 'query' });
  assert.deepEqual(requests[1].body.embeddings, [[0.1, 0.2], [0.3, 0.4]]);
});
