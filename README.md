# CueMap TypeScript SDK

**High-performance temporal-associative memory store** that mimics the brain's recall mechanism.

## Overview

CueMap implements a **Continuous Gradient Algorithm** inspired by biological memory:

1.  **Intersection (Context Filter)**: Triangulates relevant memories by overlapping cues
2.  **Pattern Completion (Associative Recall)**: Automatically infers missing cues from co-occurrence history, enabling recall from partial inputs.
3.  **Recency & Salience (Signal Dynamics)**: Balances fresh data with salient, high-signal events prioritized by the Amygdala-inspired salience module.
4.  **Reinforcement (Hebbian Learning)**: Frequently accessed memories gain signal strength, staying "front of mind".
5.  **Autonomous Consolidation**: Periodically merges overlapping memories into summaries, mimicking systems consolidation.

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

// Add a memory (auto-cue generation by default using internal Semantic Engine)
await client.add("The server password is abc123", []);

// Recall by natural language (resolves via Lexicon)
const results = await client.recall(
  "server credentials", // query text
  undefined, // cues
  undefined, // projects
  10 // limit
);

console.log(results[0].content);
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

// Auto-cues (Semantic Engine)
await client.add("The payments service is down due to a timeout", []);
```

### Recall Memories

```typescript
// Natural Language Search
const results = await client.recall(
  "payments failure", // query_text
  undefined,    // cues
  undefined,    // projects
  10,           // limit
  false,        // auto_reinforce
  undefined,    // min_intersection
  true          // explain
);

console.log(results[0].explain);
// Shows normalized cues, expanded synonyms, etc.
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

### Context Expansion (v0.6.1)

Explore related concepts from the cue graph to expand a user's query.

```typescript
const response = await client.contextExpand("server hung 137", 5);
// {
//   "query_cues": ["server", "hung", "137"],
//   "expansions": [
//     { "term": "out_of_memory", "score": 25.0, "co_occurrence_count": 12 },
//     { "term": "SIGKILL", "score": 22.0, "co_occurrence_count": 8 }
//   ]
// }
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

// Ingest Raw Content
await client.ingestContent("Raw text content...", "notes.txt");
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

// Get synonyms via WordNet
const synonyms = await client.lexiconSynonyms("payment");
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
const results = await client.recall(
  "urgent issue", // query
  undefined,
  undefined,
  10,
  false,
  undefined,
  false, // explain
  true,  // disablePatternCompletion
  true,  // disableSalienceBias
  true   // disableSystemsConsolidation
);
```

## Performance

- **Write Latency**: ~2ms (O(1) complexity)
- **Read Latency**: ~5-10ms (Raw vs Smart Recall)

## License

MIT
