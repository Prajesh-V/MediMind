# M5: Test Plan

## 1. Goal
Verify the Deterministic Medical Interaction Engine behaves entirely as specified without external influence or deviation. Test rule matching, conflict resolution, security boundaries, and reproducibility.

## 2. Rule Matching Scenarios
- **Exact RxCUI Match**: Test `type: "exact_rxcui"`. Ensure a patient taking both medications triggers the rule. Ensure taking only one does not.
- **Ingredient Match**: Test resolving an active drug to its ingredient string and matching it.
- **Non-Match**: Provide a medication profile entirely unrelated to the rule. Verify output is empty.
- **Multiple Matches**: Provide a profile that triggers two different rules simultaneously. Verify both assessments are generated.

## 3. Rule Lifecycle Scenarios
- **Approved Matching**: Only rules where `status = 'approved'` evaluate to matches.
- **Draft/Submitted/Retired Exclusion**: Inject draft, submitted, and retired rules that perfectly match the patient's medications. Verify the engine silently ignores them.

## 4. Conflict Resolution Scenarios
- **Severity Overlap**: Create two approved rules matching the same medication pair (e.g. one FDA `moderate`, one RxNorm `high`). Verify the engine produces one assessment with `high` severity.
- **Version Conflict**: (Covered by governance in M4: concurrent active versions of the same rule are impossible; one must be retired. The engine automatically prefers the active one).

## 5. Security Scenarios
- **Patient Isolation**: Log in as Patient A. Call `getPatientAssessments(Patient_B_ID)`. Expect `Unauthorized`.
- **Professional Connection**: 
  - Log in as Professional A (active connection to Patient A). Expect success.
  - Revoke connection. Call again. Expect `Unauthorized`.
  - Leave connection pending. Call again. Expect `Unauthorized`.
- **Tampering**: Verify clients cannot intercept or mutate the generated assessment before UI render since matching runs completely Server-Side.

## 6. Reproducibility
- Pass the identical test profile twice. Verify the exact same `assessment_id` (if deterministic hashing is used) or the exact same content outputs.
- Verify NO LLM calls occur in the entire execution trace.
