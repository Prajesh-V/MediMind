# M5: API Contracts

## 1. Goal
Define the boundaries for document upload, extraction, and candidate confirmation Server Actions.

## 2. Server Actions

### `uploadDocument`
```typescript
/**
 * Securely uploads a document to Supabase Storage and records it in `uploaded_documents`.
 * Checks file size and type limitations.
 */
export async function uploadDocument(file: File, category: 'prescription' | 'food'): Promise<{ documentId: string }>
```

### `extractPrescription`
```typescript
/**
 * Triggers an OCR extraction run on the specified document.
 * Normalizes results via RxNorm and stages them in `prescription_candidates`.
 */
export async function extractPrescription(documentId: string): Promise<{
  extractionRunId: string;
  candidates: Array<{
    id: string; // prescription_candidate id
    rxcui: string | null;
    medication_name: string;
    dosage?: string;
    confidence: 'high' | 'low';
    warnings: string[];
  }>;
}>
```

### `extractFoodImage`
```typescript
/**
 * Triggers a vision analysis run on the specified document.
 * Stages probabilistic components in `food_intake_candidates`.
 */
export async function extractFoodImage(documentId: string): Promise<{
  extractionRunId: string;
  candidates: Array<{
    id: string;
    component_name: string;
    confidence_score: number;
  }>;
}>
```

### `confirmFoodCandidate`
```typescript
/**
 * Patient action to explicitly confirm a vision-detected food component.
 * Promotes it to `patient_dietary_intake`.
 */
export async function confirmFoodCandidate(candidateId: string, editedName?: string): Promise<{ intakeId: string }>
```
*(Prescription confirmation leverages the existing M3 `confirmPrescription` action).*

## 3. Security Requirements
- All Server Actions verify `auth.uid()`.
- A professional attempting to call these actions for a patient ID must pass the M2 `active` connection verification check.
- Uploads are constrained by Signed URLs or backend-only Supabase Storage proxy streams to prevent direct bucket access bypass.
