# M4: Test Plan

## 1. Source Adapters Testing
- **Successful Retrieval**: Verify HTTP 200 responses are correctly parsed and mapped to the normalized internal type.
- **Source Unavailable**: Simulate HTTP 500/503 errors and verify the circuit breaker opens and falls back to cache if available.
- **Malformed Response**: Simulate missing fields or unexpected JSON structures and ensure the adapter gracefully rejects the payload without crashing.
- **Timeout**: Enforce strict timeout limits (e.g., 5 seconds) and verify timeout errors are caught and handled.
- **Rate Limit**: Simulate HTTP 429 and verify exponential backoff and retry behavior up to the maximum retry count.
- **Stale Data**: Verify that requesting an expired cache entry while the source is down still returns the cached data but flagged as `stale`.

## 2. Evidence Traceability Testing
- **Provenance Completeness**: Assert that every successfully created evidence record contains `jurisdiction`, `source_name`, `source_identifier`, and `retrieved_timestamp`.
- **Jurisdiction Checks**: Assert that jurisdiction labels are correctly populated and preserved (e.g., DailyMed mapped to US-FDA).
- **Source Version**: Verify that version information (like SPL Set ID) is stored correctly.
- **Evidence Traceability**: Ensure querying a rule returns the full join of its linked evidence payload.

## 3. Rule Lifecycle Testing
- **Draft Creation**: Verify rules can be created in the `draft` state with linked evidence.
- **Submission**: Verify state transitions from `draft` to `submitted`.
- **Approval**: Verify a user with `clinical_reviewer` role can transition a rule to `approved` only if evidence is present, reviewer ID is populated, and timestamps are valid.
- **Rejection**: Verify a `submitted` rule transitions back to `draft` when rejected, and the rejection reason is logged.
- **Retirement**: Verify an `approved` rule can be retired.
- **Unauthorized Approval Attempt**: Assert that attempting to approve a rule without the `clinical_reviewer` role throws a 403 Forbidden.
- **Missing Evidence Rejection**: Assert that approving a rule without a valid `evidence_id` fails structurally.

## 4. Security Testing
- **Patient Isolation**: Verify that a patient account cannot insert, update, or approve any rule in the `medical_knowledge` schema.
- **Ordinary User Restrictions**: Verify standard professional accounts (without reviewer credentials) cannot approve rules.
- **Boundary Verification**: Ensure professional access to patient records remains completely distinct from access to the shared medical knowledge tables.
