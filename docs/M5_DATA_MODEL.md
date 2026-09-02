# M5: Data Model

## 1. Core Principles
- Re-use existing M3 pipeline entities (`patient_medications`, `prescription_candidates`) where possible.
- Normalize extraction runs and raw file references independently of the clinical confirmation data to ensure provenance traceability.

## 2. New Entities

### `public.uploaded_documents`
Stores references to raw files securely uploaded to Supabase Storage.
- `id` (uuid, pk)
- `patient_id` (uuid, fk to patients)
- `storage_path` (text)
- `file_type` (enum: image, pdf)
- `document_category` (enum: prescription, food)
- `created_at` (timestamptz)

### `public.extraction_runs`
Tracks the processing attempts against a document.
- `id` (uuid, pk)
- `document_id` (uuid, fk to uploaded_documents)
- `service_provider` (text, e.g. "Google Cloud DocumentAI", "Gemini Vision")
- `status` (enum: pending, success, failed)
- `raw_payload` (jsonb) - Stored for debugging/provenance. Size constraints apply.
- `created_at` (timestamptz)

### `public.food_intake_candidates`
Stages probabilistic vision output for dietary intake.
- `id` (uuid, pk)
- `patient_id` (uuid, fk to patients)
- `extraction_run_id` (uuid, fk to extraction_runs)
- `component_name` (text, e.g. "grapefruit")
- `confidence_score` (float)
- `status` (enum: pending_review, confirmed, rejected)

### `public.patient_dietary_intake`
The confirmed canonical truth resulting from patient approval.
- `id` (uuid, pk)
- `patient_id` (uuid, fk to patients)
- `component_name` (text)
- `consumed_at` (timestamptz)
- `provenance_candidate_id` (uuid, fk to food_intake_candidates, nullable for manual entry)

## 3. Extending Existing Entities
- **M3 `prescription_candidates`**: Add an `extraction_run_id` (uuid, nullable) column to link an OCR-extracted candidate back to its source document and extraction run. This satisfies the provenance chain: `uploaded_documents -> extraction_runs -> prescription_candidates -> patient_medications`.

## 4. Provenance & Isolation
The separation cleanly guarantees that raw `extraction_runs` and `uploaded_documents` never leak into M6 clinical evaluations. M6 only reads from `patient_medications` and `patient_dietary_intake`.
