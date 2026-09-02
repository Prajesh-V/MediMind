# M5: Assessment API

## 1. Goal
Define the Server Actions and internal API contracts for generating and fetching deterministic assessments.

## 2. API Contract

### Generate Assessment (Internal Engine Call)
```typescript
/**
 * Evaluates the patient's active medications against approved interaction rules.
 * Runs completely deterministicly without LLMs.
 */
export async function generateAssessments(patientId: string): Promise<InteractionAssessment[]>
```

### Fetch Assessments (Client Actions)
```typescript
/**
 * Patient Action: Fetch assessments for their own profile.
 * Security: Validates auth.uid() === patientId
 */
export async function getPatientAssessments(patientId: string): Promise<InteractionAssessment[]>

/**
 * Professional Action: Fetch assessments for a connected patient.
 * Security: Validates auth.uid() has an 'active' connection to patientId in M2.
 */
export async function getProfessionalAssessments(patientId: string): Promise<InteractionAssessment[]>
```

## 3. Caching and Performance
- The `generateAssessments` function will utilize Next.js `unstable_cache` with a cache key combination of `[patientId, 'active_medications_hash']`.
- When a patient updates their medications (M3 actions), `revalidateTag(patientId)` will invalidate the cached assessment.
- When an authorized reviewer approves a new rule (M4 actions), `revalidateTag('assessments')` globally invalidates all cached assessments, ensuring patients immediately receive updated clinical guidance.

## 4. Professional Escalation Audit
```typescript
/**
 * Marks a high-severity assessment as reviewed/acknowledged by a professional.
 */
export async function acknowledgeAssessment(patientId: string, assessmentId: string): Promise<void>
```
- Acknowledgment creates a formal audit event `assessment_acknowledged` in `public.audit_log`, tying the `auth.uid()` of the professional to the specific ephemeral `assessmentId` and the exact time of review.
