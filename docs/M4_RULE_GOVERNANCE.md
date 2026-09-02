# M4: Rule Governance

## 1. Rule Governance Lifecycle
The clinical rule lifecycle is strict and must not be bypassed by any user, process, or AI mechanism.

The valid states for a rule are:
1. `draft` - Initial state (manually created, or extracted from evidence via automated/AI means).
2. `submitted` - Ready for human clinical review.
3. `approved` - Active and enforceable in the system.
4. `retired` - No longer active (due to overriding evidence, retraction, or expiration).

*Note: Rejected submitted rules return to the `draft` state.*

## 2. Clinical Review Workflow
Rules move from `submitted` to `approved` ONLY through qualified human review.

### Reviewer Profile Requirements
- **Reviewer Role**: The user must have a specific role (e.g., `clinical_reviewer`).
- **Credential Reference**: The reviewer must have a verified legal/medical credential stored in their profile. If these requirements are not yet defined legally, they must be marked as pending human business decisions, but the technical workflow must require them.

### Approval Requirements
To approve a rule, the reviewer must provide/verify:
1. Valid linked evidence (the rule cannot be approved without an `evidence_id`).
2. Their identity (`reviewer_id`).
3. An `approval_timestamp`.
4. An `effective_date`.

### Rejection Requirements
If rejected, the reviewer must provide a rejection reason (e.g., "Misinterpreted label," "Outdated source") which attaches to the draft rule's audit log.

## 3. Rule Versioning & Re-Approval
- **Immutable Approvals**: Once approved, a rule cannot be mutated. 
- **Versioning**: Any edits to an approved rule result in a new `draft` rule (V2) which must go through the entire submission and approval process. The original rule remains active until V2 is approved.
- **Evidence Changes**: If the underlying evidence changes (e.g., FDA label update), all dependent rules are flagged. A reviewer must assess if the rule should be `retired` or if it remains valid under the new evidence.

## 4. Deterministic Rule Model
M4 establishes the foundational data model for deterministic evaluation (to be implemented in M5/M6).

The engine expects:
```
[Patient Medication] + [Approved Interaction Rule] + [Evidence Reference] = [Deterministic Assessment]
```
The rule payload itself must be machine-readable (e.g., `condition: (DRUG_A AND DRUG_B), effect: SEVERE_INTERACTION`), entirely independent of LLM evaluation.

## 5. Security Model
- RLS policies restrict the `approved` status mutation to the `clinical_reviewer` role.
- Patient accounts and standard Professional accounts **cannot** approve rules.
- Only `approved` rules are accessible to the patient-facing evaluation engine.
- Complete audit trails are written to `public.audit_log` for every state transition.
