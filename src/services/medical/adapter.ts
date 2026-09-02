export interface SourceQuery {
  term?: string;
  rxcui?: string;
  limit?: number;
}

export interface AdapterHealthStatus {
  available: boolean;
  latencyMs?: number;
  lastChecked: Date;
  statusMessage?: string;
}

export interface SourceResponse<T> {
  data: T | null;
  source: string;
  jurisdiction: 'US-FDA' | 'US-NLM' | 'US' | 'GLOBAL';
  identifier: string;
  retrievedAt: Date;
  version?: string;
  rawPayload: any;
  stale: boolean;
}

export interface SourceAdapter<T> {
  lookup(query: SourceQuery): Promise<SourceResponse<T[]> | null>;
  retrieval(sourceId: string): Promise<SourceResponse<T> | null>;
  normalization(rawData: any): T;
  checkAvailability(): Promise<AdapterHealthStatus>;
}

export class BaseAdapter {
  protected circuitBreakerFailures = 0;
  protected lastFailureTime: number | null = null;
  protected readonly breakerThreshold = 3;
  protected readonly resetTimeoutMs = 60000; // 1 minute

  isCircuitOpen(): boolean {
    if (this.circuitBreakerFailures >= this.breakerThreshold) {
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.circuitBreakerFailures = 0;
        return false;
      }
      return true;
    }
    return false;
  }

  recordFailure() {
    this.circuitBreakerFailures++;
    this.lastFailureTime = Date.now();
  }

  recordSuccess() {
    this.circuitBreakerFailures = 0;
    this.lastFailureTime = null;
  }

  protected async fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
    if (this.isCircuitOpen()) {
      throw new Error(`Circuit breaker open for ${url}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        
        if (res.ok) {
          this.recordSuccess();
          clearTimeout(timeoutId);
          return res;
        }

        if (res.status === 429) {
          // Rate limit, exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(r => setTimeout(r, delay));
          attempt++;
          continue;
        }

        // 5xx errors or others
        this.recordFailure();
        clearTimeout(timeoutId);
        throw new Error(`HTTP ${res.status}`);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message === 'fetch failed') {
          this.recordFailure();
        }
        attempt++;
        if (attempt >= maxRetries) {
          clearTimeout(timeoutId);
          throw err;
        }
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
    clearTimeout(timeoutId);
    throw new Error('Max retries exceeded');
  }
}
