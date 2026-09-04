<p align="center">
  <img src="https://cuemap.dev/cuemap-logo.PNG" alt="CueMap" width="120">
</p>

<h1 align="center">CueMap TypeScript SDK</h1>

<p align="center">A polished TypeScript client for fast, accurate, and explainable agent memory.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cuemap"><img src="https://img.shields.io/npm/v/cuemap?logo=npm" alt="npm"></a>
  <a href="https://www.npmjs.com/package/cuemap"><img src="https://img.shields.io/npm/dm/cuemap?logo=npm" alt="npm downloads"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-ready-3178c6?logo=typescript&logoColor=white" alt="TypeScript"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-5e5ce6" alt="License"></a>
</p>

**High-performance temporal-associative memory store** designed for dynamic contextual retrieval.

## Overview

CueMap implements a **Continuous Gradient Algorithm** optimized for associative data structures:

1.  **Intersection (Context Filter)**: Triangulates relevant memories by overlapping cues
2.  **Local Semantic and Intent Reranking**: Uses bundled qint8 MiniLM-L3 by default, or q4 MiniLM-L3 with the edge profile.
3.  **Recency & Salience (Signal Dynamics)**: Balances fresh data with salient, high-signal events prioritized by an adaptive impact scoring module.
4.  **Reinforcement (Access-based Learning)**: Frequently accessed memories gain signal strength, remaining highly accessible even as they age.
5.  **Deterministic Facets & Intent Routing**: Extracts synchronous source, evidence, temporal, type, and entity facets, then uses sparse intent cues and reranking during recall.

As of v0.7.3, CueMap keeps deterministic lexical candidate discovery and adds bundled qint8 `all-MiniLM-L3-v2` for bounded hybrid semantic and intent reranking. The `edge` engine profile uses a q4 build of the same model. No runtime model download is required, and callers can disable the encoder or provide their own vectors.

v0.7.3 also uses numeric per-project memory IDs everywhere. If callers need deterministic upsert/dedupe identity, pass `source_key`; memory IDs remain compact runtime addresses.

Use this SDK to talk to the Rust engine from TypeScript and JavaScript applications.

## Installation

```bash
npm install cuemap
```

## Quick Start

### 1. Start the Engine

```bash
docker run -p 8735:8735 cuemap/engine:latest
```

### 2. Basic Usage

```typescript
import CueMap from 'cuemap';

const client = new CueMap();

// Add a memory with deterministic cue extraction
await client.add("The server password is abc123", []);

// Recall by natural language
const response = await client.recall({
  query_text: "server credentials",
  limit: 10,
});

console.log(response.results[0].content);
// Output: "The server password is abc123"
```

## Core API

### Add Memory

```typescript
// Manual cues
await client.add(
  "Meeting with John at 3pm",
  ["meeting", "john", "calendar"]
);

// Deterministic cues are derived when cues are omitted
await client.add("The payments service is down due to a timeout", []);
```

### Recall Memories

```typescript
// Natural language search
const response = await client.recall({
  query_text: "payments failure",
  limit: 10,
  depth: 2,
  explain: true,
});

console.log(response.results[0].explain);
// Shows normalized cues, intent cues, and reranking details.
```

### v0.7.3 Recall Controls

CueMap v0.7.3 adds local semantic query signals alongside temporal query intent and the optional reconstruction passes for longer conversational/codebase context.

```typescript
const response = await client.recall({
  query_text: "what did we decide about auth retries?",
  query_time: "2026-07-06",
  ordered_reconstruction: "auto",
  evidence_coverage: "auto",
  parent_fusion: "auto",
  semantic_mode: "hybrid",
  explain: true,
});
```

### Grounded Recall (Hallucination Guardrails)

Get verifiable context for LLMs with a strict token budget.

```typescript
const response = await client.recallGrounded(
  "Why is the payment failing?",
  500 // token budget
);

console.log(response.verified_context);
// [VERIFIED CONTEXT] ...
console.log(response.proof);
// Cryptographic proof of context retrieval
```

### Project memory lifecycle

The engine can unload inactive project contexts while keeping their snapshots
on disk. Normal project operations demand-load a project when needed, so the
first request after an unload may take longer. Use the explicit helpers when
you want to control residency:

```typescript
await client.unloadProject("older-repository");
await client.loadProject("older-repository");
await client.saveProject("older-repository"); // persist without unloading

for (const project of await client.listProjects()) {
  console.log(project.project_id, project.loaded);
}
```

Portable projects use the same four operations as the CLI: `packProject()`,
`loadProjectPackage()`, `pushProject()`, and `pullProject()`.
Use `syncProject(projectId, "s3://bucket/team")` for conflict-safe fast-forward sync.

For a controlled semantic comparison, use `semantic_mode: "lexical"`. Use `"semantic"` for vector candidate discovery or `"hybrid"` (the engine default) to rerank lexical candidates with the configured local encoder. `query_embedding` can supply a precomputed vector when the application owns the embedding provider.

Classify query or memory intent with the same local model. Returned scores are ranking signals, not calibrated probabilities:

```typescript
const classification = await client.classifyIntent(
  "What did we decide about auth retries?",
  "query"
);
console.log(classification.primary_intent, classification.recall_eligible);
```

### Cloud Backup (v0.6.1)

Manage project snapshots in the cloud (S3, GCS, Azure).

```typescript
// Upload current project snapshot
await client.backupUpload("default");

// Download and restore snapshot
await client.backupDownload("default");

// List available backups
const backups = await client.backupList();
```

### Ingestion (v0.6)

Ingest content from various sources directly.

```typescript
// Ingest URL
await client.ingestUrl("https://example.com/docs");

// Ingest File (PDF, DOCX, etc.)
// Requires a File or Blob object (browser) or similar in Node
await client.ingestFile(myFileObject);

// Ingest Raw Content with v0.7 logical-block chunking
await client.ingestContent("Raw text content...", "notes.md", {
  sourceKey: "docs:notes",
  structuralCues: ["source_type:docs"],
  segmenter: "logical_block",
});
```

When an application owns chunk vectors, pass exactly one vector per produced chunk with `embeddings: [[...], [...]]`.

Preview and apply a persistent repository ingestion scope:

```typescript
const preview = await client.previewDirectory("/work/my-app");

await client.setProjectWatchDir(
  "repo-my-app-a1b2c3d4e5",
  "/work/my-app",
  ["generated/**"],
  ["map"],
  ["src", "README.md"]
);
```

New and changed supported files are ingested only when they remain inside `includedPaths` and pass discovered ignore files plus configured exclusions. Use `getProjectWatchDir(projectId)` to read the persisted scope.

When `EmbeddedCueMap` starts a local engine, its stdout and stderr are appended to `~/.cuemap/server.log` so `cuemap logs` reports the live embedded instance. Set `CUEMAP_LOG_PATH` or pass `logPath` to use another file; pass `logPath: false` only when log capture is intentionally disabled.

### Lexicon Management (v0.6)

Inspect and wire the brain's associations manually.

```typescript
// Inspect a cue's relationships
const data = await client.lexiconInspect("service:payment");
console.log("Synonyms:", data.outgoing);
console.log("Triggers:", data.incoming);

// Manually wire a token to a concept
await client.lexiconWire("stripe", "service:payment");

```

### Job Status (v0.6)

Check the progress of background ingestion tasks.

```typescript
const status = await client.jobsStatus();
console.log(`Ingested: ${status.writes_completed} / ${status.writes_total}`);
console.log(`Intent ready: ${status.intent_ready ?? false}`);
```

## License

MIT
