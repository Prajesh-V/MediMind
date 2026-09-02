# M4: Evidence Model

## 1. Traceability Principle
Every clinical rule in the MediMind system must be directly traceable to an authoritative source. An approved rule must never exist without sufficient documented evidence.

## 2. Evidence Model Structure
The evidence chain follows this strict hierarchy:
`Approved Rule` -> `Evidence Reference` -> `Normalized Evidence` -> `Source Payload / Source Identifier`

### Evidence Record Schema Concept
```sql
CREATE TABLE medical_knowledge.evidence (
  id UUID PRIMARY KEY,
  source_name TEXT NOT NULL,          -- e.g., 'DailyMed', 'openFDA'
  jurisdiction TEXT NOT NULL,         -- e.g., 'US-FDA', 'US-NLM'
  source_url TEXT,                    -- The exact URL or API endpoint
  source_identifier TEXT NOT NULL,    -- e.g., SPL Set ID, Application Number
  source_version TEXT,                -- The specific version of the document/label
  retrieved_timestamp TIMESTAMPTZ NOT NULL,
  evidence_type TEXT NOT NULL,        -- e.g., 'BOXED_WARNING', 'DRUG_INTERACTION'
  medication_rxcui TEXT NOT NULL,     -- The normalized drug identifier
  claim_text TEXT NOT NULL,           -- The specific claim/rule content extracted
  raw_payload JSONB                   -- The full JSON response for audit purposes
);
```

## 3. Jurisdiction & Applicability
- **Jurisdiction Column**: Clearly marks the origin of the regulation or label.
- **Unavailable / Conflicting Evidence**: 
  - If evidence is unavailable, rules based on that evidence must be suspended.
  - If sources conflict, the most recent update takes precedence, and human review is required to resolve.
- **Outdated Evidence**: Evidence must be re-verified against the source on a scheduled cadence (e.g., every 30 days). If the source document has changed or been retracted, the associated rule is flagged for re-approval.

## 4. LLM Boundary
- Gemini or any other LLM **cannot** invent evidence.
- An LLM may be used purely to *extract* candidate claims from the `raw_payload` (e.g., extracting interactions from a DailyMed PDF/XML), but this extracted claim goes into the system as `draft` evidence requiring human review.
