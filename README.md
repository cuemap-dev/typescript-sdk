# CueMap TypeScript SDK

**High-performance temporal-associative memory store** designed for dynamic contextual retrieval.

## Overview

CueMap implements a **Continuous Gradient Algorithm** optimized for associative data structures:

1.  **Intersection (Context Filter)**: Triangulates relevant memories by overlapping cues
2.  **CuePack-Guided Intent Routing**: Uses compiled deterministic rules to add structural facets and weighted intent cues without runtime model calls.
3.  **Recency & Salience (Signal Dynamics)**: Balances fresh data with salient, high-signal events prioritized by an adaptive impact scoring module.
4.  **Reinforcement (Access-based Learning)**: Frequently accessed memories gain signal strength, remaining highly accessible even as they age.
5.  **Deterministic Facets & Intent Routing**: Extracts synchronous source, evidence, temporal, type, and entity facets, then uses sparse intent cues and reranking during recall.

As of v0.7.0, CueMap's core path is deterministic and embedding-free. GloVe/Ollama cue generation, WordNet/POS expansion, semantic bridges, pattern completion, external lexicon graphs, context expansion/speculation endpoints, and autonomous consolidation have been removed from the core engine.

v0.7.0 also uses numeric per-project memory IDs everywhere. If callers need deterministic upsert/dedupe identity, pass `source_key`; memory IDs remain compact runtime addresses.

Use this SDK to talk to the Rust engine from TypeScript and JavaScript applications.

## Installation

```bash
npm install cuemap
```

## Quick Start

### 1. Start the Engine

```bash
docker run -p 8080:8080 cuemap/engine:latest
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

### v0.7 Recall Controls

CueMap v0.7 adds temporal query intent, CueBridge artifact expansion, and optional reconstruction passes for longer conversational/codebase context.

```typescript
const response = await client.recall({
  query_text: "what did we decide about auth retries?",
  query_time: "2026-07-06",
  ordered_reconstruction: "auto",
  evidence_coverage: "auto",
  parent_fusion: "auto",
  cuepacks: ["default"],
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
```

### Advanced Brain Control

Disable specific brain modules for deterministic debugging.

```typescript
const response = await client.recall({
  query_text: "urgent issue",
  disable_salience_bias: true,
  disable_alias_expansion: true,
  disable_cuebridge_artifacts: true,
});
```

## Performance

- **Write Latency**: ~2ms (O(1) complexity)
- **Read Latency**: ~3ms (P99, 1M memories)

## License

MIT
