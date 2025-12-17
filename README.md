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

## TypeScript Types

```typescript
interface RecallResult {
  memory_id: string;
  content: string;
  score: number;
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

### Manual Cues (Production)

```typescript
// Explicit, predictable cues
await client.add(
  "Deploy command: kubectl apply -f deployment.yaml",
  ["deployment", "kubernetes", "commands", "devops"]
);

await client.add(
  "API endpoint: https://api.example.com/v1/users",
  ["api", "endpoint", "users", "documentation"]
);

// Query with specific cues
const deploymentDocs = await client.recall(["deployment", "kubernetes"]);
const apiDocs = await client.recall(["api", "users"]);
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
