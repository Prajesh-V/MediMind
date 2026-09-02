import { BaseAdapter, SourceAdapter, SourceQuery, SourceResponse, AdapterHealthStatus } from './adapter';

export interface DailyMedLabel {
  setid: string;
  title: string;
  spl_version: string;
  published_date: string;
}

const DAILYMED_BASE = process.env.DAILYMED_BASE_URL || 'https://dailymed.nlm.nih.gov/dailymed/services/v2';

export class DailyMedAdapter extends BaseAdapter implements SourceAdapter<DailyMedLabel> {
  async lookup(query: SourceQuery): Promise<SourceResponse<DailyMedLabel[]> | null> {
    if (!query.rxcui) return null;
    
    try {
      const url = `${DAILYMED_BASE}/spls.json?rxcui=${encodeURIComponent(query.rxcui)}`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const spls = data?.data || [];
      
      const normalized = spls.map((s: any) => this.normalization(s));
      return {
        data: normalized,
        source: 'dailymed',
        jurisdiction: 'US-FDA',
        identifier: query.rxcui,
        retrievedAt: new Date(),
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error('Error querying DailyMed API:', error);
      return null;
    }
  }

  async retrieval(setid: string): Promise<SourceResponse<DailyMedLabel> | null> {
    if (!setid) return null;

    try {
      const url = `${DAILYMED_BASE}/spls/${encodeURIComponent(setid)}.json`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const label = data?.data;
      
      if (!label) return null;

      const normalized = this.normalization(label);
      return {
        data: normalized,
        source: 'dailymed',
        jurisdiction: 'US-FDA',
        identifier: setid,
        retrievedAt: new Date(),
        version: normalized.spl_version,
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error(`Error fetching DailyMed SPL ${setid}:`, error);
      return null;
    }
  }

  normalization(rawData: any): DailyMedLabel {
    return {
      setid: rawData.setid,
      title: rawData.title,
      spl_version: rawData.spl_version?.toString() || '1',
      published_date: rawData.published_date
    };
  }

  async checkAvailability(): Promise<AdapterHealthStatus> {
    try {
      const start = Date.now();
      // Ping a lightweight endpoint to check availability
      const res = await fetch(`${DAILYMED_BASE}/classes.json`, { signal: AbortSignal.timeout(3000) });
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

export const dailyMedAdapter = new DailyMedAdapter();
