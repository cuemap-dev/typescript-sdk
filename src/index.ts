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
  metadata: Record<string, any>;
}

export interface AddMemoryRequest {
  content: string;
  cues: string[];
  metadata?: Record<string, any>;
}

export interface RecallRequest {
  cues: string[];
  limit?: number;
  auto_reinforce?: boolean;
  min_intersection?: number;
  projects?: string[];
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
    metadata?: Record<string, any>
  ): Promise<string> {
    const response = await this.request<{ id: string }>(
      'POST',
      '/memories',
      { content, cues, metadata: metadata || {} }
    );
    return response.id;
  }

  /**
   * Recall memories by cues
   * 
   * @param cues - List of cues to search for
   * @param limit - Maximum results to return
   * @param autoReinforce - Automatically reinforce retrieved memories
   * @param minIntersection - Minimum number of cues that must match (for strict AND logic)
   * @param projects - List of project IDs for cross-domain queries (multi-tenant only)
   * 
   * @example
   * // OR logic (default): matches any cue
   * const results = await client.recall(['meeting', 'john']);
   * 
   * @example
   * // AND logic: requires both cues
   * const results = await client.recall(['meeting', 'john'], 10, false, 2);
   * 
   * @example
   * // Cross-domain query (multi-tenant)
   * const results = await client.recall(['urgent'], 10, false, undefined, ['sales', 'support']);
   */
  async recall(
    cues: string[],
    limit: number = 10,
    autoReinforce: boolean = false,
    minIntersection?: number,
    projects?: string[]
  ): Promise<RecallResult[]> {
    const payload: RecallRequest = {
      cues,
      limit,
      auto_reinforce: autoReinforce,
    };

    if (minIntersection !== undefined) {
      payload.min_intersection = minIntersection;
    }

    if (projects !== undefined) {
      payload.projects = projects;
    }

    const response = await this.request<{ results: RecallResult[] }>(
      'POST',
      '/recall',
      payload
    );
    return response.results;
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
}

export default CueMap;
