/**
 * CueMap TypeScript SDK
 * Redis for AI Agents - High-performance temporal-associative memory
 */

export interface CueMapConfig {
  url?: string;
  apiKey?: string;
  projectId?: string;
  timeout?: number;
}

export interface Memory {
  id: string;
  content: string;
  cues: string[];
  metadata: Record<string, any>;
  created_at: number;
  last_accessed: number;
}

export interface RecallResult {
  memory_id: string;
  content: string;
  score: number;
  intersection_count: number;
  recency_score: number;
  reinforcement_score: number;
  salience: number;
  match_integrity: number;
  structural_cues: string[];
  metadata: Record<string, any>;
  explain?: Record<string, any>;
}

export interface AddMemoryRequest {
  content: string;
  cues: string[];
  metadata?: Record<string, any>;
  disable_temporal_chunking?: boolean;
}

export interface RecallRequest {
  cues?: string[];
  query_text?: string;
  limit?: number;
  auto_reinforce?: boolean;
  min_intersection?: number;
  projects?: string[];
  explain?: boolean;
  disable_pattern_completion?: boolean;
  disable_salience_bias?: boolean;
  disable_systems_consolidation?: boolean;
}

export interface ReinforceRequest {
  cues: string[];
}

export class CueMapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CueMapError';
  }
}

export class CueMap {
  private url: string;
  private apiKey?: string;
  private projectId?: string;
  private timeout: number;

  constructor(config: CueMapConfig = {}) {
    this.url = config.url || 'http://localhost:8080';
    this.apiKey = config.apiKey;
    this.projectId = config.projectId;
    this.timeout = config.timeout || 30000;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    if (this.projectId) {
      headers['X-Project-ID'] = this.projectId;
    }

    return headers;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}${path}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 401) {
          throw new CueMapError('Invalid API key');
        }
        throw new CueMapError(`Request failed: ${response.status}`);
      }

      return await response.json() as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof CueMapError) {
        throw error;
      }
      throw new CueMapError(`Request failed: ${error}`);
    }
  }

  /**
   * Add a memory with explicit cues
   */
  async add(
    content: string,
    cues: string[],
    metadata?: Record<string, any>,
    disableTemporalChunking: boolean = false
  ): Promise<string> {
    const response = await this.request<{ id: string }>(
      'POST',
      '/memories',
      { content, cues, metadata: metadata || {}, disable_temporal_chunking: disableTemporalChunking }
    );
    return response.id;
  }

  /**
   * Recall memories by cues or natural language
   * 
   * @param queryText - Natural language query to resolve via Lexicon
   * @param cues - List of cues to search for
   * @param limit - Maximum results to return
   * @param autoReinforce - Automatically reinforce retrieved memories
   * @param minIntersection - Minimum number of cues that must match
   * @param projects - List of project IDs for cross-domain queries
   * @param explain - Include recall explanation in results
   */
  async recall(
    queryText?: string,
    cues?: string[],
    projects?: string[],
    limit: number = 10,
    autoReinforce: boolean = false,
    minIntersection?: number,
    explain: boolean = false,
    disablePatternCompletion: boolean = false,
    disableSalienceBias: boolean = false,
    disableSystemsConsolidation: boolean = false
  ): Promise<any> {
    const payload: RecallRequest = {
      limit,
      auto_reinforce: autoReinforce,
      explain,
      disable_pattern_completion: disablePatternCompletion,
      disable_salience_bias: disableSalienceBias,
      disable_systems_consolidation: disableSystemsConsolidation,
    };

    if (cues) {
      payload.cues = cues;
    }

    if (queryText) {
      payload.query_text = queryText;
    }

    if (minIntersection !== undefined) {
      payload.min_intersection = minIntersection;
    }

    if (projects !== undefined) {
      payload.projects = projects;
    }

    const response = await this.request<any>(
      'POST',
      '/recall',
      payload
    );

    return response;
  }

  /**
   * List all projects (multi-tenant only)
   */
  async listProjects(): Promise<string[]> {
    return await this.request<string[]>('GET', '/projects');
  }

  /**
   * Delete a project (multi-tenant only)
   */
  async deleteProject(projectId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/projects/${projectId}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add a manual alias (cue mapping)
   */
  async addAlias(from: string, to: string, weight: number = 1.0): Promise<boolean> {
    try {
      await this.request('POST', '/aliases', { from, to, weight });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all aliases, optionally filtered by cue
   */
  async getAliases(cue?: string): Promise<any[]> {
    const path = cue ? `/aliases?cue=${encodeURIComponent(cue)}` : '/aliases';
    return await this.request<any[]>('GET', path);
  }

  /**
   * Merge multiple cues into a canonical canonical cue
   */
  async mergeAliases(cues: string[], to: string): Promise<boolean> {
    try {
      await this.request('POST', '/aliases/merge', { cues, to });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reinforce a memory on specific cue pathways
   */
  async reinforce(memoryId: string, cues: string[]): Promise<boolean> {
    try {
      await this.request('PATCH', `/memories/${memoryId}/reinforce`, { cues });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a memory by ID
   */
  async get(memoryId: string): Promise<Memory> {
    return await this.request<Memory>('GET', `/memories/${memoryId}`);
  }

  /**
   * Get server statistics
   */
  async stats(): Promise<Record<string, any>> {
    return await this.request<Record<string, any>>('GET', '/stats');
  }

  /**
   * Recall grounded context with token budgeting
   */
  async recallGrounded(
    query: string,
    tokenBudget: number = 500,
    limit: number = 10,
    projects?: string[],
    disablePatternCompletion: boolean = false,
    disableSalienceBias: boolean = false,
    disableSystemsConsolidation: boolean = false
  ): Promise<RecallGroundedResponse> {
    const payload: RecallGroundedRequest = {
      query_text: query,
      token_budget: tokenBudget,
      limit,
      disable_pattern_completion: disablePatternCompletion,
      disable_salience_bias: disableSalienceBias,
      disable_systems_consolidation: disableSystemsConsolidation,
    };

    if (projects) {
      payload.projects = projects;
    }

    return await this.request<RecallGroundedResponse>(
      'POST',
      '/recall/grounded',
      payload
    );
  }

  // --- Lexicon Methods ---

  /**
   * Manually wire a token to a canonical cue
   */
  async lexiconWire(token: string, canonical: string): Promise<any> {
    return await this.request<any>('POST', '/lexicon/wire', { token, canonical });
  }

  /**
   * Inspect a cue's relationships in the Lexicon
   */
  async lexiconInspect(cue: string): Promise<any> {
    const encoded = encodeURIComponent(cue);
    return await this.request<any>('GET', `/lexicon/inspect/${encoded}`);
  }

  /**
   * Get the full Lexicon graph
   */
  async lexiconGraph(): Promise<any> {
    return await this.request<any>('GET', '/lexicon/graph');
  }

  /**
   * Get WordNet synonyms and graph suggestions for a cue
   */
  async lexiconSynonyms(cue: string): Promise<any> {
    const encoded = encodeURIComponent(cue);
    return await this.request<any>('GET', `/lexicon/synonyms/${encoded}`);
  }

  /**
   * Delete a Lexicon entry
   */
  async lexiconDelete(memoryId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/lexicon/entry/${memoryId}`);
      return true;
    } catch {
      return false;
    }
  }

  // --- Ingestion Methods ---

  /**
   * Ingest content from a URL
   */
  async ingestUrl(url: string): Promise<any> {
    return await this.request<any>('POST', '/ingest/url', { url });
  }

  /**
   * Ingest raw content
   */
  async ingestContent(content: string, filename: string = "content.txt"): Promise<any> {
    return await this.request<any>('POST', '/ingest/content', { content, filename });
  }

  /**
   * Ingest a file (File/Blob)
   * Note: This bypasses the json wrapper request() method because it uses FormData
   */
  async ingestFile(file: any): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const headers = this.getHeaders();
    // Remove Content-Type so fetch can set it with boundary
    delete headers['Content-Type'];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}/ingest/file`, {
        method: 'POST',
        headers: headers,
        body: formData,
        signal: controller.signal as any,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new CueMapError(`Request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw new CueMapError(`Request failed: ${error}`);
    }
  }

  // --- Job Status ---

  /**
   * Get background job status for the current project
   */
  async jobsStatus(): Promise<any> {
    return await this.request<any>('GET', '/jobs/status');
  }
}

export interface SelectedItem {
  memory_id: string;
  content: string;
  score: number;
  intersection_count: number;
  recency_component: number;
  reinforcement_component: number;
  match_integrity: number;
  source: string;
  timestamp: string;
  estimated_tokens: number;
  why: string;
}

export interface ExcludedItem {
  memory_id: string;
  score: number;
  reason: string;
}

export interface GroundingProof {
  trace_id: string;
  query_text: string;
  normalized_query: string[];
  expanded_cues: [string, number][];
  token_budget: number;
  selected: SelectedItem[];
  excluded_top: ExcludedItem[];
}

export interface RecallGroundedRequest {
  query_text: string;
  token_budget: number;
  limit?: number;
  projects?: string[];
  disable_pattern_completion?: boolean;
  disable_salience_bias?: boolean;
  disable_systems_consolidation?: boolean;
}

export interface RecallGroundedResponse {
  verified_context: string;
  proof: GroundingProof;
  engine_latency_ms: number;
}

/**
 * Tiny library for Relevance Compression & Grounding
 */
export class CueMapGroundingRetriever {
  private client: CueMap;

  constructor(configOrClient?: CueMapConfig | CueMap) {
    if (configOrClient instanceof CueMap) {
      this.client = configOrClient;
    } else {
      this.client = new CueMap(configOrClient);
    }
  }

  /**
   * Retrieve grounded context for prompt injection
   */
  async retrieveGrounded(
    queryText: string,
    tokenBudget: number = 500,
    limit: number = 10,
    projects?: string[],
    disablePatternCompletion: boolean = false
  ): Promise<{
    verified_context_block: string;
    grounding_proof: GroundingProof;
    selected_memories: SelectedItem[];
  }> {
    const response = await this.client.recallGrounded(
      queryText,
      tokenBudget,
      limit,
      projects,
      disablePatternCompletion
    );

    return {
      verified_context_block: response.verified_context,
      grounding_proof: response.proof,
      selected_memories: response.proof.selected,
    };
  }
}

export default CueMap;
