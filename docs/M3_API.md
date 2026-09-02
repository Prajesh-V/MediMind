# M3: API Contracts & Server Action Specification

## 1. Overview
All data mutations and queries strictly adhere to the security pipeline:
$$\text{Request} \longrightarrow \text{Authentication (JWT)} \longrightarrow \text{Schema Validation (Zod)} \longrightarrow \text{Domain Authorization} \longrightarrow \text{Audit Log} \longrightarrow \text{Response}$$

---

## 2. Server Actions & API Endpoints

### 2.1 Medication Search & RxNorm Normalization
- **Endpoint / Action**: `searchMedications(query: string)`
- **Authentication**: Authenticated User
- **Logic**:
  1. Queries NLM RxNav REST API `approximateTerm?term={query}`.
  2. For top results, fetches normalized concept properties via `/rxcui/{rxcui}/allProperties`.
  3. Returns structured array:
     ```typescript
     interface RxNormConcept {
       rxcui: string;
       name: string;
       synonym?: string;
       dosageForm?: string;
       strength?: string;
       score?: number;
     }
     ```

### 2.2 Patient Medication Management
- **`createPatientMedication(input: CreateMedicationDTO)`**
  - **Input**:
    ```typescript
    interface CreateMedicationDTO {
      rxcui?: string;
      displayName: string;
      genericName?: string;
      dosageAmount?: number;
      dosageUnit?: string;
      dosageForm?: string;
      foodRelation: 'no_relation' | 'before_meal' | 'with_meal' | 'after_meal' | 'empty_stomach';
      administrationInstructions?: string;
      startDate?: string;
      endDate?: string;
      isPrn?: boolean;
      schedules?: Array<{
        timeOfDay: string; // '08:00:00'
        slotLabel: 'morning' | 'afternoon' | 'evening' | 'night' | 'custom';
        daysOfWeek?: number[]; // null for daily
        doseQuantity: number;
      }>;
    }
    ```
  - **Authorization**: Derives `patient_id` strictly from `auth.uid()`.
  - **Side-Effects**: Inserts `patient_medications`, inserts `medication_schedules`, generates initial 7-day projection in `scheduled_doses`, and writes audit record `medication_created`.

- **`updatePatientMedication(id: string, input: UpdateMedicationDTO)`**
  - **Authorization**: Checks `patient_id = auth.uid()`.

- **`archivePatientMedication(id: string)`**
  - **Logic**: Sets `is_active = false`, cancels future `pending` scheduled doses.

### 2.3 Prescriptions & Candidate Confirmation
- **`createPrescription(input: CreatePrescriptionDTO)`**
- **`confirmPrescriptionCandidate(candidateId: string, medicationOverrides: CreateMedicationDTO)`**
  - **Logic**: Validates ownership, executes `createPatientMedication`, sets candidate `status = 'confirmed'`, sets `confirmed_medication_id`.
- **`rejectPrescriptionCandidate(candidateId: string)`**

### 2.4 Dose Logging & Adherence
- **`logDoseEvent(input: LogDoseDTO)`**
  - **Input**:
    ```typescript
    interface LogDoseDTO {
      patientMedicationId: string;
      scheduledDoseId?: string;
      status: 'taken' | 'skipped' | 'late';
      takenAt?: string; // ISO string
      doseQuantity?: number;
      notes?: string;
    }
    ```
  - **Logic**: Records `dose_events`. If linked to a `scheduled_dose_id`, updates `scheduled_doses.status` to matching state.

- **`getPatientAdherence(patientId?: string, windowDays: number = 30)`**
  - **Authorization**: If `patientId` is provided and $\neq \text{auth.uid()}$, verifies that caller is a professional with an `active` connection.
  - **Output**: Returns calculated adherence rate, total scheduled, taken on time, late, and missed counts.
