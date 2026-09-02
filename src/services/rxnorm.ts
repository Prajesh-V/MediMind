import { BaseAdapter, SourceAdapter, SourceQuery, SourceResponse, AdapterHealthStatus } from './medical/adapter';

export interface RxNormCandidate {
  rxcui: string;
  name: string;
  synonym?: string;
  score?: number;
  rank?: number;
  tty?: string;
}

const RXNORM_BASE = process.env.RXNORM_BASE_URL || 'https://rxnav.nlm.nih.gov/REST';

export class RxNormAdapter extends BaseAdapter implements SourceAdapter<RxNormCandidate> {
  async lookup(query: SourceQuery): Promise<SourceResponse<RxNormCandidate[]> | null> {
    if (!query.term || query.term.trim().length < 2) return null;
    const term = encodeURIComponent(query.term.trim());
    const limit = query.limit || 8;
    
    try {
      const url = `${RXNORM_BASE}/approximateTerm.json?term=${term}&maxEntries=${limit * 2}`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const candidates = data?.approximateGroup?.candidate || [];
      
      // Group by rxcui and pick the best clinical concept name
      const rxcuiMap = new Map<string, RxNormCandidate>();

      for (const c of candidates) {
        if (!c.rxcui) continue;
        const candidateName = c.name || c.synonym;
        const existing = rxcuiMap.get(c.rxcui);

        if (!existing) {
          if (candidateName) {
            rxcuiMap.set(c.rxcui, this.normalization(c));
          }
        } else if (candidateName && (!existing.name || c.source === 'RXNORM' || c.source === 'DRUGBANK')) {
          existing.name = candidateName;
        }
      }

      const normalized = Array.from(rxcuiMap.values()).slice(0, limit);

      return {
        data: normalized,
        source: 'rxnorm',
        jurisdiction: 'US-NLM',
        identifier: query.term,
        retrievedAt: new Date(),
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error('Error querying RxNorm API:', error);
      return null;
    }
  }

  async retrieval(rxcui: string): Promise<SourceResponse<RxNormCandidate> | null> {
    if (!rxcui) return null;

    try {
      const url = `${RXNORM_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const prop = data?.properties;
      
      if (!prop) return null;

      const normalized = this.normalization(prop);
      return {
        data: normalized,
        source: 'rxnorm',
        jurisdiction: 'US-NLM',
        identifier: rxcui,
        retrievedAt: new Date(),
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error(`Error fetching RxCUI ${rxcui} properties:`, error);
      return null;
    }
  }

  normalization(rawData: any): RxNormCandidate {
    return {
      rxcui: rawData.rxcui,
      name: rawData.name,
      score: rawData.score ? parseFloat(rawData.score) : undefined,
      rank: rawData.rank ? parseInt(rawData.rank, 10) : undefined,
      synonym: rawData.synonym || undefined,
      tty: rawData.tty || undefined
    };
  }

  async checkAvailability(): Promise<AdapterHealthStatus> {
    try {
      const start = Date.now();
      const res = await fetch(`${RXNORM_BASE}/version.json`, { signal: AbortSignal.timeout(3000) });
      return {
        available: res.ok,
        latencyMs: Date.now() - start,
        lastChecked: new Date(),
        statusMessage: res.statusText
      };
    } catch (err: any) {
      return {
        available: false,
        lastChecked: new Date(),
        statusMessage: err.message
      };
    }
  }
}

// Preserve existing functions for backwards compatibility in M3
const adapter = new RxNormAdapter();

export async function searchRxNorm(term: string): Promise<RxNormCandidate[]> {
  const result = await adapter.lookup({ term });
  return result?.data || [];
}

export async function getRxNormProperties(rxcui: string) {
  const result = await adapter.retrieval(rxcui);
  return result?.data || null;
}
