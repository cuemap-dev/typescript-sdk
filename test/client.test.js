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

test('project lifecycle methods use the load and unload routes', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, method: options.method });
    return {
      ok: true,
      json: async () => ({
        status: String(url).endsWith('/load')
          ? 'loaded'
          : String(url).endsWith('/save') ? 'saved' : 'unloaded',
        loaded: String(url).endsWith('/load'),
      }),
    };
  };

  const client = new CueMap({ projectId: 'lifecycle-test' });
  assert.equal((await client.loadProject('repo/one')).loaded, true);
  assert.equal((await client.saveProject('repo/one')).status, 'saved');
  assert.equal((await client.unloadProject('repo/one')).loaded, false);

  assert.match(requests[0].url, /\/projects\/repo%2Fone\/load$/);
  assert.match(requests[1].url, /\/projects\/repo%2Fone\/save$/);
  assert.match(requests[2].url, /\/projects\/repo%2Fone\/unload$/);
  assert.deepEqual(requests.map((request) => request.method), ['POST', 'POST', 'POST']);
});

test('project package methods use the matching engine routes', async (context) => {
  const originalFetch = global.fetch;
  context.after(() => {
    global.fetch = originalFetch;
  });

  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, method: options.method, body: options.body, headers: options.headers });
    if (String(url).endsWith('/pack')) {
      return {
        ok: true,
        arrayBuffer: async () => Uint8Array.from([67, 85, 69]).buffer,
      };
    }
    return {
      ok: true,
      json: async () => ({ status: 'loaded', project_id: 'repo-package', file_count: 1, size_bytes: 3 }),
    };
  };

  const client = new CueMap({ projectId: 'package-test' });
  const packageData = await client.packProject('repo/package');
  assert.deepEqual([...packageData], [67, 85, 69]);
  await client.loadProjectPackage(packageData);
  await client.pushProject('repo/package', 's3://bucket/team/');
  await client.pullProject('s3://bucket/team/repo-package.cuemap');
  await client.syncProject('repo/package', 's3://bucket/team-sync');

  assert.match(requests[0].url, /\/projects\/repo%2Fpackage\/pack$/);
  assert.match(requests[1].url, /\/projects\/load$/);
  assert.equal(requests[1].headers['Content-Type'], 'application/vnd.cuemap.project');
  assert.match(requests[2].url, /\/projects\/repo%2Fpackage\/push$/);
  assert.deepEqual(JSON.parse(requests[2].body), { destination: 's3://bucket/team/' });
  assert.match(requests[3].url, /\/projects\/pull$/);
  assert.deepEqual(JSON.parse(requests[3].body), { source: 's3://bucket/team/repo-package.cuemap' });
  assert.match(requests[4].url, /\/projects\/repo%2Fpackage\/sync$/);
  assert.deepEqual(JSON.parse(requests[4].body), { remote: 's3://bucket/team-sync' });
});

test('recall sends v0.7.3 semantic controls', async (context) => {
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
