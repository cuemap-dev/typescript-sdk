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

export type MemoryId = number | string;
export type RecallExpansionMode = 'off' | 'auto' | 'force';
export type TextSegmenterMode = 'sentence_window' | 'logical_block';

export interface Memory {
  id: MemoryId;
  content: string | number[];
  source_key?: string | null;
  cues: string[];
  metadata: Record<string, any>;
  created_at?: number;
  last_accessed?: number;
  disk_backed?: boolean;
  scoring_features?: Record<string, any>;
  stats?: Record<string, any>;
}

export interface RecallResult {
  memory_id: MemoryId;
  content: string;
  score: number;
  intersection_count: number;
  recency_score: number;
  reinforcement_score: number;
  salience_score: number;
  salience?: number;
  match_integrity: number;
  created_at?: number;
  structural_cues: string[];
  metadata: Record<string, any>;
  explain?: Record<string, any>;
}

export interface AddMemoryRequest {
  content: string;
  cues?: string[];
  source_key?: string;
  metadata?: Record<string, any>;
  cuepacks?: string[];
  disable_temporal_chunking?: boolean;
  async_ingest?: boolean;
  minimal_response?: boolean;
  trace_timing?: boolean;
}

export interface AddMemoryOptions {
  sourceKey?: string;
  cuepacks?: string[];
  asyncIngest?: boolean;
  minimalResponse?: boolean;
  traceTiming?: boolean;
}

export interface RecallRequest {
  cues?: string[];
  query_text?: string;
  query_time?: string;
  limit?: number;
  depth?: number;
  auto_reinforce?: boolean;
  min_intersection?: number;
  projects?: string[];
  explain?: boolean;
  trace_timing?: boolean;
  disable_salience_bias?: boolean;
  disable_alias_expansion?: boolean;
  expansion_depth?: number;
  cuepacks?: string[];
  parent_fusion?: RecallExpansionMode;
  parent_fusion_limit?: number;
  parent_fusion_min_chunks?: number;
  ordered_reconstruction?: RecallExpansionMode;
  ordered_reconstruction_limit?: number;
  ordered_session_scan_limit?: number;
  ordered_max_sessions?: number;
  evidence_coverage?: RecallExpansionMode;
  evidence_coverage_limit?: number;
  evidence_coverage_session_scan_limit?: number;
  evidence_coverage_max_sessions?: number;
  disable_cuebridge_artifacts?: boolean;
  cuebridge_gap_limit?: number;
  /** @deprecated Removed from the v0.7 engine. Accepted for source compatibility but not sent. */
  disable_pattern_completion?: boolean;
  /** @deprecated Removed from the v0.7 engine. Accepted for source compatibility but not sent. */
  disable_systems_consolidation?: boolean;
}

export interface ReinforceRequest {
  cues: string[];
}

export interface IngestContentOptions {
  sourceKey?: string;
  metadata?: Record<string, any>;
  structuralCues?: string[];
  segmenter?: TextSegmenterMode;
  segmentWindowSize?: number;
  segmentOverlap?: number;
  segmentMinChunkChars?: number;
  segmentMaxChunkChars?: number;
}

export interface DebugAnalyzeTextOptions {
  queryTime?: string;
  metadata?: Record<string, any>;
  existingCues?: string[];
  availableCues?: string[];
  cuepacks?: string[];
  filename?: string;
  segmenter?: TextSegmenterMode;
  segmentWindowSize?: number;
  segmentOverlap?: number;
  segmentMinChunkChars?: number;
  segmentMaxChunkChars?: number;
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

  private cleanBody<T extends Record<string, any>>(body: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(body).filter(([, value]) => value !== undefined)
    ) as Partial<T>;
  }

  private normalizeRecallPayload(payload: RecallRequest): RecallRequest {
    const {
      disable_pattern_completion: _disablePatternCompletion,
      disable_systems_consolidation: _disableSystemsConsolidation,
      ...rest
    } = payload;
    return this.cleanBody(rest) as RecallRequest;
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
    cues: string[] = [],
    metadata?: Record<string, any>,
    disableTemporalChunking: boolean = false,
    options: AddMemoryOptions = {}
  ): Promise<MemoryId> {
    const response = await this.request<{ id: MemoryId }>(
      'POST',
      '/memories',
      this.cleanBody({
        content,
        cues,
        metadata,
        disable_temporal_chunking: disableTemporalChunking,
        source_key: options.sourceKey,
        cuepacks: options.cuepacks,
        async_ingest: options.asyncIngest,
        minimal_response: options.minimalResponse,
        trace_timing: options.traceTiming,
      })
    );
    return response.id;
  }

  /**
   * Add multiple memories in one request
   */
  async addBatch(
    memories: AddMemoryRequest[],
    minimalResponse: boolean = false,
    traceTiming: boolean = false
  ): Promise<any> {
    return await this.request<any>(
      'POST',
      '/memories/batch',
      {
        memories,
        minimal_response: minimalResponse,
        trace_timing: traceTiming,
      }
    );
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
  async recall(options: RecallRequest): Promise<any>;
  async recall(
    queryText?: string,
    cues?: string[],
    projects?: string[],
    limit?: number,
    depth?: number,
    autoReinforce?: boolean,
    minIntersection?: number,
    explain?: boolean,
    disablePatternCompletion?: boolean,
    disableSalienceBias?: boolean,
    disableSystemsConsolidation?: boolean,
    disableAliasExpansion?: boolean,
    options?: Partial<RecallRequest>
  ): Promise<any>;
  async recall(
    queryTextOrOptions?: string | RecallRequest,
    cues?: string[],
    projects?: string[],
    limit: number = 10,
    depth: number = 1,
    autoReinforce: boolean = false,
    minIntersection?: number,
    explain: boolean = false,
    _disablePatternCompletion: boolean = false,
    disableSalienceBias: boolean = false,
    _disableSystemsConsolidation: boolean = false,
    disableAliasExpansion: boolean = true,
    options: Partial<RecallRequest> = {}
  ): Promise<any> {
    const payload: RecallRequest =
      typeof queryTextOrOptions === 'object' && queryTextOrOptions !== null
        ? queryTextOrOptions
        : {
            ...options,
            query_text: queryTextOrOptions,
            cues,
            projects,
            limit,
            depth,
            auto_reinforce: autoReinforce,
            min_intersection: minIntersection,
            explain,
            disable_salience_bias: disableSalienceBias,
            disable_alias_expansion: disableAliasExpansion,
          };

    const response = await this.request<any>(
      'POST',
      '/recall',
      this.normalizeRecallPayload(payload)
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
   * Create a new project (multi-tenant only)
   */
  async createProject(projectId: string): Promise<any> {
    return await this.request<any>('POST', '/projects', { project_id: projectId });
  }

  /**
   * Set the watch directory for a project
   */
  async setProjectWatchDir(
    projectId: string,
    watchDir: string,
    ignoredPatterns?: string[],
    ignoredExtensions?: string[]
  ): Promise<any> {
    return await this.request<any>(
      'POST',
      `/projects/${projectId}/watch-dir`,
      this.cleanBody({
        watch_dir: watchDir,
        ignored_patterns: ignoredPatterns,
        ignored_extensions: ignoredExtensions,
      })
    );
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
   * Get CueBridge artifact summary for a project
   */
  async projectArtifacts(projectId: string): Promise<any> {
    return await this.request<any>('GET', `/projects/${projectId}/artifacts`);
  }

  /**
   * Reload CueBridge artifacts for a project
   */
  async reloadProjectArtifacts(projectId: string): Promise<any> {
    return await this.request<any>('POST', `/projects/${projectId}/artifacts`);
  }

  /**
   * Export project memories with cursor pagination
   */
  async exportProject(
    projectId: string,
    options: {
      cursor?: MemoryId;
      limit?: number;
      includeContent?: boolean;
      includeCues?: boolean;
      includeMetadata?: boolean;
    } = {}
  ): Promise<any> {
    const params = new URLSearchParams();
    if (options.cursor !== undefined) params.set('cursor', String(options.cursor));
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.includeContent !== undefined) params.set('include_content', String(options.includeContent));
    if (options.includeCues !== undefined) params.set('include_cues', String(options.includeCues));
    if (options.includeMetadata !== undefined) params.set('include_metadata', String(options.includeMetadata));
    const suffix = params.toString();
    return await this.request<any>('GET', `/projects/${projectId}/export${suffix ? `?${suffix}` : ''}`);
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
    autoReinforce: boolean = true,
    minIntersection?: number,
    disableSalienceBias: boolean = false,
    disableAliasExpansion: boolean = true,
    options: Partial<RecallGroundedRequest> = {}
  ): Promise<RecallGroundedResponse> {
    const payload: RecallGroundedRequest = {
      ...options,
      query_text: query,
      token_budget: tokenBudget,
      limit,
      auto_reinforce: autoReinforce,
      disable_salience_bias: disableSalienceBias,
      disable_alias_expansion: disableAliasExpansion,
    };

    if (projects) {
      payload.projects = projects;
    }

    if (minIntersection !== undefined) {
      payload.min_intersection = minIntersection;
    }

    return await this.request<RecallGroundedResponse>(
      'POST',
      '/recall/grounded',
      this.normalizeRecallPayload(payload)
    );
  }

  // --- Backup Methods ---

  /**
   * Upload project snapshot to cloud backup
   */
  async backupUpload(projectId: string): Promise<any> {
    return await this.request<any>('POST', '/backup/upload', { project_id: projectId });
  }

  /**
   * Download project snapshot from cloud backup
   */
  async backupDownload(projectId: string): Promise<any> {
    return await this.request<any>('POST', '/backup/download', { project_id: projectId });
  }

  /**
   * List available cloud backups
   */
  async backupList(): Promise<any> {
    return await this.request<any>('GET', '/backup/list');
  }

  /**
   * Delete a cloud backup
   */
  async backupDelete(projectId: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/backup/${projectId}`);
      return true;
    } catch {
      return false;
    }
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

  /**
   * Ingest content from a URL with optional recursive crawling
   * @param url - The URL to ingest
   * @param depth - Crawl depth (0=single page, 1+=recursive)
   * @param sameDomainOnly - Only follow links within the same domain (default: true)
   */
  async ingestUrl(url: string, depth: number = 0, sameDomainOnly: boolean = true): Promise<any> {
    const payload: any = { url };
    if (depth > 0) {
      payload.depth = depth;
      payload.same_domain_only = sameDomainOnly;
    }
    return await this.request<any>('POST', '/ingest/url', payload);
  }

  /**
   * Ingest raw content
   */
  async ingestContent(
    content: string,
    filename: string = "content.txt",
    options: IngestContentOptions = {}
  ): Promise<any> {
    return await this.request<any>(
      'POST',
      '/ingest/content',
      this.cleanBody({
        content,
        filename,
        source_key: options.sourceKey,
        metadata: options.metadata,
        structural_cues: options.structuralCues,
        segmenter: options.segmenter,
        segment_window_size: options.segmentWindowSize,
        segment_overlap: options.segmentOverlap,
        segment_min_chunk_chars: options.segmentMinChunkChars,
        segment_max_chunk_chars: options.segmentMaxChunkChars,
      })
    );
  }

  /**
   * Recall directly from a URL or web search result set
   */
  async recallWeb(query: string, url?: string, persist: boolean = false): Promise<any> {
    return await this.request<any>(
      'POST',
      '/recall/web',
      this.cleanBody({ query, url, persist })
    );
  }

  /**
   * Analyze v0.7 cue extraction, query intent, and chunking for text
   */
  async debugAnalyzeText(text: string, options: DebugAnalyzeTextOptions = {}): Promise<any> {
    return await this.request<any>(
      'POST',
      '/debug/analyze-text',
      this.cleanBody({
        text,
        query_time: options.queryTime,
        metadata: options.metadata,
        existing_cues: options.existingCues,
        available_cues: options.availableCues,
        cuepacks: options.cuepacks,
        filename: options.filename,
        segmenter: options.segmenter,
        segment_window_size: options.segmentWindowSize,
        segment_overlap: options.segmentOverlap,
        segment_min_chunk_chars: options.segmentMinChunkChars,
        segment_max_chunk_chars: options.segmentMaxChunkChars,
      })
    );
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
   * Get background job status for a project or globally
   */
  async jobsStatus(projectId?: string): Promise<any> {
    const headers = this.getHeaders();
    if (projectId) {
      headers['X-Project-ID'] = projectId;
    }

    // Using a direct fetch instead of `this.request` because `request` uses `this.getHeaders()` internally overriding this one unless we pass headers down.
    // Let's modify the helper to accept custom headers, or just use fetch here:
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}/jobs/status`, {
        method: 'GET',
        headers: headers,
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
}

export interface SelectedItem {
  memory_id: MemoryId;
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
  memory_id: MemoryId;
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
  auto_reinforce?: boolean;
  min_intersection?: number;
  projects?: string[];
  disable_salience_bias?: boolean;
  disable_alias_expansion?: boolean;
  expansion_depth?: number;
  cuepacks?: string[];
  /** @deprecated Removed from the v0.7 engine. Accepted for source compatibility but not sent. */
  disable_pattern_completion?: boolean;
  /** @deprecated Removed from the v0.7 engine. Accepted for source compatibility but not sent. */
  disable_systems_consolidation?: boolean;
}

export interface RecallGroundedResponse {
  verified_context: string;
  proof: GroundingProof;
  engine_latency_ms: number;
  signature_alg?: string;
  signature?: string;
  public_key?: string | null;
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
    autoReinforce: boolean = true,
    minIntersection?: number,
    options: Partial<RecallGroundedRequest> = {}
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
      autoReinforce,
      minIntersection,
      options.disable_salience_bias ?? false,
      options.disable_alias_expansion ?? true,
      options
    );

    return {
      verified_context_block: response.verified_context,
      grounding_proof: response.proof,
      selected_memories: response.proof.selected,
    };
  }
}

export default CueMap;
