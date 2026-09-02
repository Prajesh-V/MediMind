# M4: API Contracts

## 1. Source Adapters

### RxNorm Adapter
```typescript
interface RxNormAdapter {
  search(term: string): Promise<RxNormCandidate[]>;
  getProperties(rxcui: string): Promise<RxNormProperties>;
  getInteractions(rxcui: string): Promise<InteractionEvidence[]>;
}
```

### DailyMed Adapter
```typescript
interface DailyMedAdapter {
  searchLabel(rxcui: string): Promise<DailyMedLabel[]>;
  getLabelDetails(setid: string): Promise<DailyMedLabelDetail>;
}
```

### openFDA Adapter
```typescript
interface OpenFDAAdapter {
  getAdverseEvents(drugName: string): Promise<AdverseEventReport[]>;
  getRecalls(rxcui: string): Promise<RecallNotice[]>;
}
```

## 2. Evidence API
Internal server actions managing the evidence lifecycle.

```typescript
// Fetch evidence from cache or directly from adapter if stale
async function fetchEvidence(source: string, identifier: string): Promise<EvidenceRecord>;

// Create an evidence reference linking to the source
async function createEvidenceReference(payload: EvidenceCreationPayload): Promise<string /* evidence_id */>;
```

## 3. Rule Governance API

```typescript
// Submit a draft rule for review
async function submitRule(ruleId: string): Promise<void>;

// Approve a submitted rule (requires clinical_reviewer role)
async function approveRule(ruleId: string, approvalData: ApprovalPayload): Promise<void>;

// Reject a submitted rule
async function rejectRule(ruleId: string, reason: string): Promise<void>;

// Retire an active rule
async function retireRule(ruleId: string, reason: string): Promise<void>;
```

## 4. Integration Guidelines
- All API routes mutating rules must verify session authentication and role authorization via Supabase `auth.users` metadata and RLS policies.
- External API calls to RxNorm/DailyMed/openFDA must originate from the server only (Server Actions or API Routes). The client never contacts external sources directly.
