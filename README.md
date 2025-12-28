# CueMap TypeScript SDK

**Redis for AI Agents** - High-performance temporal-associative memory store.

## Installation

```bash
npm install cuemap
```

## Quick Start

```typescript
import CueMap from 'cuemap';

const client = new CueMap();

// Add a memory with cues
await client.add(
  "The server password is abc123",
  ["server", "password", "credentials"]
);

// Recall by cues
const results = await client.recall(["server", "password"]);
console.log(results[0].content);
// Output: "The server password is abc123"
```

## Running the Engine

CueMap requires a running engine:

```bash
docker run -p 8080:8080 cuemap/engine:latest
```

Or from source:

```bash
git clone https://github.com/cuemap-dev/engine
cd engine
cargo build --release
./target/release/cuemap-rust --port 8080
```

## API

### Constructor

```typescript
const client = new CueMap({
  url: 'http://localhost:8080',  // Optional, default: localhost:8080
  apiKey: 'your-api-key',         // Optional
  projectId: 'my-project',        // Optional, for multi-tenancy
  timeout: 30000                  // Optional, default: 30000ms
});
```

### Add Memory

```typescript
const memoryId = await client.add(
  "Meeting with John at 3pm",
  ["meeting", "john", "calendar", "today"],
  { priority: "high" }  // Optional metadata
);
```

### Recall Memories

```typescript
// OR logic (default): matches any cue
const results = await client.recall(
  ["meeting", "john"],
  10,      // limit (optional, default: 10)
  false    // auto_reinforce (optional, default: false)
);

for (const result of results) {
  console.log(`${result.content} (score: ${result.score})`);
}

### Natural Language Recall (Deterministic)

Use the built-in Lexicon to resolve human language into canonical cues.

```typescript
// Resolved via Lexicon: "payment" -> "service:payment", "timeout" -> "error:timeout"
const results = await client.recall(undefined, 10, false, undefined, undefined, "payment timeout");
```

### Alias Management (Manual Control)

Tweak the engine's deterministic mapping directly.

```typescript
// Add a manual alias
await client.addAlias("pay", "service:payment", 0.9);

// Merge multiple terms into one canonical cue
await client.mergeAliases(["failed", "error", "bug"], "status:error");

// Get aliases
const aliases = await client.getAliases("pay");
```

### Safety: Disable Pattern Completion

For peak determinism, disable the brain-inspired associative expansion.

```typescript
// Strict matching only, no associative inference
const results = await client.recall(
  ["urgent"],
  10,
  false,
  undefined,
  undefined,
  undefined,
  false, // explain
  true   // disablePatternCompletion
);
```

### Explainable Recall

See how the query was normalized and expanded.

```typescript
const results = await client.recall(
  undefined,
  10,
  false,
  undefined,
  undefined,
  "payment failed",
  true // explain
);

// Access explanation
console.log(results[0].explain);
```

// AND logic: requires all cues to match
const strictResults = await client.recall(
  ["meeting", "john"],
  10,
  false,
  2  // min_intersection: both cues must match
);

// Cross-domain query (multi-tenant mode)
const crossDomainResults = await client.recall(
  ["urgent"],
  10,
  false,
  undefined,
  ["sales", "support", "engineering"]  // projects
);
```

### Reinforce Memory

```typescript
await client.reinforce(memoryId, ["important", "urgent"]);
```

### Get Memory

```typescript
const memory = await client.get(memoryId);
console.log(memory.content);
```

### Get Stats

```typescript
const stats = await client.stats();
console.log(`Total memories: ${stats.total_memories}`);
```

## Advanced Controls (Safety Audit)

For peak determinism or specific recall strategies, you can disable brain-inspired features per-request.

```typescript
// 1. Disable Pattern Completion (Strict matching only)
const results = await client.recall(
  ["urgent"],
  10,
  false,
  undefined,
  undefined,
  undefined,
  false,
  true // disablePatternCompletion
);

// 2. Disable Salience Bias (Ignore "importance" signals)
const legacyResults = await client.recall(
  undefined,
  10,
  false,
  undefined,
  undefined,
  "server logs",
  false,
  false,
  true // disableSalienceBias
);

// 3. Disable Systems Consolidation (Ignore summarized "gist" memories)
const rawResults = await client.recall(
  undefined,
  10,
  false,
  undefined,
  undefined,
  "project history",
  false,
  false,
  false,
  true // disableSystemsConsolidation
);

// 4. Disable Temporal Chunking (Stop automatic episode creation at write-time)
await client.add(
  "Standalone event",
  ["event"],
  {},
  true // disableTemporalChunking
);
```

## TypeScript Types

```typescript
interface RecallResult {
  memory_id: string;
  content: string;
  score: number;
  match_integrity: number;
  salience: number;
  structural_cues: string[];
  intersection_count: number;
  recency_score: number;
  metadata: Record<string, any>;
}

interface Memory {
  id: string;
  content: string;
  cues: string[];
  metadata: Record<string, any>;
  created_at: number;
  last_accessed: number;
}
```

## Examples

### With OpenAI

```typescript
import CueMap from 'cuemap';
import OpenAI from 'openai';

const client = new CueMap();
const openai = new OpenAI();

async function storeWithAITags(content: string) {
  // Let OpenAI extract the cues
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{
      role: "system",
      content: "Extract 3-5 search tags from the text. Return as JSON array."
    }, {
      role: "user",
      content: content
    }]
  });
  
  const cues = JSON.parse(response.choices[0].message.content);
  return await client.add(content, cues);
}

await storeWithAITags("I need to buy groceries this weekend");
```

### With LangChain

```typescript
import CueMap from 'cuemap';
import { BaseMemory } from 'langchain/memory';

class CueMapMemory extends BaseMemory {
  private client: CueMap;
  private extractCues: (text: string) => Promise<string[]>;

  constructor(cueExtractor: (text: string) => Promise<string[]>) {
    super();
    this.client = new CueMap();
    this.extractCues = cueExtractor;
  }

  async saveContext(inputs: any, outputs: any): Promise<void> {
    const context = `User: ${inputs.input}\nAI: ${outputs.output}`;
    const cues = await this.extractCues(context);
    await this.client.add(context, cues);
  }

  async loadMemoryVariables(inputs: any): Promise<any> {
    const cues = await this.extractCues(inputs.input);
    const results = await this.client.recall(cues, 5);
    return { history: results.map(r => r.content).join('\n') };
  }
}
```

const deploymentDocs = await client.recall(["deployment", "kubernetes"]);
const apiDocs = await client.recall(["api", "users"]);

## Grounding & Token Budgeting (v0.5)

CueMap v0.5 introduces the **Relevance Compression Engine** to prevent LLM hallucinations by providing a "Hallucination Guardrail".

### Grounded Recall

Get the most relevant context formatted specifically for LLM prompts, within a strict token budget.

```typescript
const result = await client.recallGrounded(
  "Why is the payment failing?",
  500, // tokenBudget
  10   // limit
);

console.log(result.verified_context);
// Output: [VERIFIED CONTEXT] (1) Fact... Rules: Use only context...
```

### CueMapGroundingRetriever (Middleware)

A tiny library for easy integration into custom pipelines.

```typescript
import { CueMapGroundingRetriever } from 'cuemap';

const retriever = new CueMapGroundingRetriever();
const result = await retriever.retrieveGrounded(
  "Why did the database fail?",
  300
);

// context ready for prompt injection
const prompt = `Answer this query: ${query}\n\n${result.verified_context_block}`;
```

## Error Handling

```typescript
import { CueMapError } from 'cuemap';

try {
  await client.add("content", ["cue1"]);
} catch (error) {
  if (error instanceof CueMapError) {
    console.error('CueMap error:', error.message);
  }
}
```

## Performance (~1M memories)

- **Write P99**: ~0.33ms
- **Read P99**: ~0.37ms
- **Throughput**: ~2,900+ ops/sec

## Philosophy

**What CueMap Does:**
- ✅ Fast storage (sub-millisecond)
- ✅ Temporal ordering (recent memories prioritized)
- ✅ Intersection scoring (multi-cue matching)
- ✅ Reinforcement (move-to-front)

**What CueMap Doesn't Do:**
- ❌ Auto-tagging (you provide the cues)
- ❌ Semantic search (use your own embeddings)
- ❌ LLM integration (bring your own model)
- ❌ Magic (explicit and predictable)

## Links

- [Engine Repository](https://github.com/cuemap-dev/engine)
- [SDKs Repository](https://github.com/cuemap-dev/sdks)

## License

MIT
