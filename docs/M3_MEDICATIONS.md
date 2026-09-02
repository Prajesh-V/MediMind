# M3: Medication & Prescription Architecture Specification

## 1. Overview & Core Philosophy
Milestone M3 establishes the foundational medication data engine for MediMind. It provides the single source of truth for:
- Medication identity & RxNorm clinical normalization
- Patient medication profiles & administration instructions
- Prescription records & candidate staging workflows
- Flexible, timezone-aware dose schedules
- Concrete dose event tracking & deterministic adherence metrics
- Role-based clinical visibility for authorized healthcare professionals

### Canonical Data Pathway Principle
There is **one and only one** pipeline for confirmed patient medication records:
```
[Manual User Input]           [Prescription Document]
        │                                │
        │                       [OCR/Candidate Staging]
        │                                │
        └──────────────┬─────────────────┘
                       ▼
          [RxNorm Normalization Engine]
                       │
                       ▼
          [Patient Review & Confirmation]
                       │
                       ▼
          [Active Patient Medication Record]
                       │
                       ▼
          [Schedule & Dose Event Generation]
```
**Rule:** AI, OCR, or third-party extractions are strictly staged as *unconfirmed candidates*. No medication can become active or generate doses without explicit patient confirmation.

---

## 2. Domain Models & Lifecycle

### 2.1 Medication Identity vs. Patient Regimen
To ensure clinical integrity and clean downstream food-drug interaction matching, medication data is partitioned into:
1. **Medication Identity (Clinical Concept)**: RxCUI, generic name, brand name, normalized strength, dosage form (e.g. RxCUI `197361` -> `Amlodipine 5 MG Oral Tablet`).
2. **Patient Regimen (Patient-Specific Instructions)**: Patient ID, dose quantity, frequency, schedule timing, food relation (e.g. `with_meal`), start/end dates, active status.

### 2.2 RxNorm Normalization Strategy
- **Primary Source**: National Library of Medicine (NLM) RxNav REST API (`https://rxnav.nlm.nih.gov/REST`).
- **Endpoint Workflow**:
  1. `approximateTerm`: Resolves misspellings and free text into candidate RxCUIs with confidence scores.
  2. `rxcui/{rxcui}/allProperties`: Fetches official generic name, brand names, dosage form, and strength.
  3. `rxcui/{rxcui}/allrelated`: Finds clinical drugs (SCD/SBD) and active ingredient concepts (IN/MIN).
- **Verification States**:
  - `verified_rxnorm`: Successfully linked to an authoritative RxCUI.
  - `unverified`: Free-text medication where RxNorm resolution was unavailable or ambiguous.
  - `manual_custom`: Patient explicitly opted out of standard normalization or entered a non-Rx item (e.g. herbal supplement).

### 2.3 Prescription & Candidate Staging Model
- **Prescription Entity**: Stores source document metadata (file key, doctor name, prescription date, upload timestamp).
- **Prescription Candidates**: Staging rows containing parsed text.
  - Statuses: `pending`, `confirmed`, `rejected`.
  - Upon confirmation, links directly to the newly spawned `patient_medications` record via `confirmed_medication_id`.

---

## 3. Timezone, Scheduling & Adherence Architecture

### 3.1 Timezone Handling
- **Patient Timezone**: Stored in `patients.timezone` as standard IANA identifiers (e.g. `America/New_York`, `Asia/Kolkata`, `Europe/London`).
- **Schedule Storage**: Stored as local time (`TIME without time zone`, e.g. `08:00:00`) alongside slot labels (`morning`, `noon`, `evening`, `bedtime`, `custom`) and recurring day patterns.
- **Scheduled Doses**: Projected into discrete `TIMESTAMPTZ` records in UTC based on the patient's local calendar day and active timezone.
- **Daylight Saving Time (DST)**: Because schedules store local wall-clock time (`08:00`), daily dose projection dynamically computes the correct UTC offset for each specific date, preventing 1-hour schedule shifts during DST transitions.

### 3.2 Dose Events & Logging
- **Dose Event Statuses**:
  - `taken`: Taken on time (within ±60 minutes of scheduled time).
  - `late`: Taken outside the normal adherence window.
  - `skipped`: Explicitly marked skipped by patient with reason.
  - `missed`: Unrecorded past the dosage window.
- **Adherence Calculation**:
  $$\text{Adherence Rate} = \frac{\text{Taken Doses (On-Time + Late)}}{\text{Total Scheduled Doses in Window}} \times 100\%$$
  Calculated deterministically over 7-day, 30-day, and 90-day sliding windows.

---

## 4. Food & Clinical Interaction Readiness
All medication models include standard metadata fields required for future M6/M7 engines:
- `food_relation`: `['before_meal', 'with_meal', 'after_meal', 'empty_stomach', 'no_relation']`
- `administration_instructions`: Structured text (e.g. "Take with plenty of water. Avoid grapefruit.").
- `rxcui` & `ingredient_rxcuis`: Used for exact ingredient-food interaction rule lookups.

---

## 5. Role-Based Access Control & Visibility
- **Patients**: Full read/write authority over their own medications, prescriptions, schedules, and dose events.
- **Healthcare Professionals**: Read-only access to active medications, dose schedules, and adherence statistics **only** for patients with an `active` connection in `patient_professional_connections`.
- **Pending/Revoked Connections**: Completely blocked by PostgreSQL Row Level Security (RLS).
