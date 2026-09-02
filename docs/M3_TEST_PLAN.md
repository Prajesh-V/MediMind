# M3: Comprehensive Test Plan

## 1. Overview
The M3 test suite validates medication normalization, manual entry, prescription candidate workflow, schedule generation, dose logging, deterministic adherence calculations, and strict RLS security boundaries.

---

## 2. Test Categories & Scenarios

### 2.1 Medication Identity & RxNorm Normalization
- **Case 1.1**: Exact match (e.g. "Lipitor 20mg" -> RxCUI `153658`, generic: Atorvastatin, form: Oral Tablet).
- **Case 1.2**: Approximate search / Typo tolerance (e.g. "amoxcillin 500" -> RxCUI `197319`).
- **Case 1.3**: Ambiguous results -> Returns ordered candidate list for user selection.
- **Case 1.4**: Unmatched / Custom substance -> Handles graceful fallback to `unverified` status without throwing.

### 2.2 Patient Medication & Regimen Lifecycle
- **Case 2.1**: Patient creates active medication with daily morning/evening schedule.
- **Case 2.2**: PRN (as-needed) medication created with no automatic schedule slots.
- **Case 2.3**: Patient updates administration instructions and food timing.
- **Case 2.4**: Patient archives medication -> verifies future pending scheduled doses are invalidated.

### 2.3 Prescription & Candidate Staging
- **Case 3.1**: Prescription created with 2 candidate medications in `pending` state.
- **Case 3.2**: Candidate confirmed -> verifies `patient_medications` record is created, candidate marked `confirmed`, and `confirmed_medication_id` is populated.
- **Case 3.3**: Candidate rejected -> candidate marked `rejected`, no medication record created.

### 2.4 Timezone, Scheduling & Dose Events
- **Case 4.1**: Schedule projection with `America/New_York` timezone -> verifies 08:00 AM local maps to 12:00 or 13:00 UTC depending on DST.
- **Case 4.2**: Schedule projection across Days of Week (e.g. Mon/Wed/Fri).
- **Case 4.3**: Logging dose event -> updates linked `scheduled_doses` row to `taken`.
- **Case 4.4**: Logging unscheduled / PRN dose -> records event without `scheduled_dose_id`.
- **Case 4.5**: Adherence calculation over 30-day window yields exact mathematical ratio.

### 2.5 Security & RLS Isolation Matrix
- **Case 5.1**: Patient A attempts to read Patient B's medications -> **Blocked (0 rows / 403)**.
- **Case 5.2**: Patient A attempts to create medication specifying Patient B's `patient_id` -> **Server rejects & derives ID from `auth.uid()`**.
- **Case 5.3**: Connected Doctor (Active) reads Patient A's medications -> **Allowed**.
- **Case 5.4**: Connected Doctor (Pending) reads Patient A's medications -> **Blocked**.
- **Case 5.5**: Revoked Doctor reads Patient A's medications -> **Blocked**.
- **Case 5.6**: Unconnected Doctor reads Patient A's medications -> **Blocked**.
