# M4: Medical Sources

## 1. Overview
The goal of M4 is to establish authoritative external medical sources and the adapter layer necessary for internalizing and normalizing medical evidence into the application. This layer acts as the absolute boundary between **Source of Evidence** and **Application-Derived Data**.

## 2. Configured Sources
We rely strictly on the following U.S.-based authoritative sources:
1. **RxNorm / RxNav** (NLM): For medication identities, term normalization, and medication concepts.
2. **DailyMed** (FDA): For official medication labeling, administration guidelines, and warnings.
3. **openFDA**: For adverse event reports, drug recalls, and safety signals.

*Note on Jurisdiction*: These are U.S.-source regulatory bodies. We must explicitly retain provenance linking the evidence to its U.S. jurisdiction. The system must not imply that these are India-specific medical authorities, even if the user base is in India.

## 3. Source Adapters Design
Adapters provide a uniform interface to external APIs.

### Common Adapter Contract
```typescript
interface SourceAdapter<T> {
  // Query the source with specific parameters
  lookup(query: SourceQuery): Promise<SourceResponse<T>>;
  
  // Retrieve specific entity by its source identifier
  retrieval(sourceId: string): Promise<SourceResponse<T>>;
  
  // Transform the source's native structure into the internal evidence model
  normalization(rawData: any): T;
  
  // Verify source availability and health
  checkAvailability(): Promise<AdapterHealthStatus>;
}
```

### Key Adapter Responsibilities:
- **Error Handling & Retry**: Implement exponential backoff for rate-limited requests (HTTP 429) and network timeouts.
- **Caching**: 
  - Standardize cache duration (e.g., RxNorm lookups cached for 24h, DailyMed labels for 7 days).
  - Store cached payloads with the `retrieved_timestamp`.
  - Handle stale data gracefully, falling back to cache if the source is temporarily unavailable (but marked as `stale`).
- **Provenance Mapping**: Ensure every payload returned includes source metadata (jurisdiction, version, source URL, retrieved timestamp).

## 4. Caching & Freshness Strategy
- **Source Retrieval Timestamps**: Every piece of extracted data must include `retrieved_timestamp`.
- **Stale Evidence Handling**: If the cache TTL expires and the source is down, the system may serve stale evidence with a prominent "Stale Evidence" flag.
- **Outage Behavior**: Adapters must implement circuit breakers. If a source fails consecutively, it halts requests and serves from cache until the health check passes.

## 5. Security & Boundary
- Medical knowledge is kept completely separate from patient data schemas.
- External adapters do not have access to patient contexts.
- No direct database writes from external sources; adapters provide data to the internal caching and rule generation layers only.
