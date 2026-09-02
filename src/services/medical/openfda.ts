import { BaseAdapter, SourceAdapter, SourceQuery, SourceResponse, AdapterHealthStatus } from './adapter';

export interface OpenFDAEvent {
  safetyreportid: string;
  receive_date: string;
  serious: string;
  seriousnessdeath?: string;
  patient?: any;
}

const OPENFDA_BASE = process.env.OPENFDA_BASE_URL || 'https://api.fda.gov/drug';

export class OpenFDAAdapter extends BaseAdapter implements SourceAdapter<OpenFDAEvent> {
  async lookup(query: SourceQuery): Promise<SourceResponse<OpenFDAEvent[]> | null> {
    if (!query.term) return null;
    
    try {
      const term = encodeURIComponent(`patient.drug.medicinalproduct:"${query.term}"`);
      const limit = query.limit || 10;
      const url = `${OPENFDA_BASE}/event.json?search=${term}&limit=${limit}`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const events = data?.results || [];
      
      const normalized = events.map((e: any) => this.normalization(e));
      return {
        data: normalized,
        source: 'openfda',
        jurisdiction: 'US-FDA',
        identifier: query.term,
        retrievedAt: new Date(),
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error('Error querying openFDA API:', error);
      return null;
    }
  }

  async retrieval(reportId: string): Promise<SourceResponse<OpenFDAEvent> | null> {
    if (!reportId) return null;

    try {
      const url = `${OPENFDA_BASE}/event.json?search=safetyreportid:"${encodeURIComponent(reportId)}"`;
      const res = await this.fetchWithRetry(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      const event = data?.results?.[0];
      
      if (!event) return null;

      const normalized = this.normalization(event);
      return {
        data: normalized,
        source: 'openfda',
        jurisdiction: 'US-FDA',
        identifier: reportId,
        retrievedAt: new Date(),
        rawPayload: data,
        stale: false
      };
    } catch (error) {
      console.error(`Error fetching openFDA report ${reportId}:`, error);
      return null;
    }
  }

  normalization(rawData: any): OpenFDAEvent {
    return {
      safetyreportid: rawData.safetyreportid,
      receive_date: rawData.receivedate,
      serious: rawData.serious,
      seriousnessdeath: rawData.seriousnessdeath,
      patient: rawData.patient
    };
  }

  async checkAvailability(): Promise<AdapterHealthStatus> {
    try {
      const start = Date.now();
      const res = await fetch(`${OPENFDA_BASE}/event.json?limit=1`, { signal: AbortSignal.timeout(3000) });
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

export const openFdaAdapter = new OpenFDAAdapter();
