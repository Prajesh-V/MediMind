# M5: Test Plan

## 1. Goal
Verify that Multimodal Intake safely processes images into structured candidates WITHOUT violating the confirmation invariant or leaking data boundaries.

## 2. Invariant Verification
- **CRITICAL**: Extraction CANNOT directly create an active medication. Verify that pushing an OCR result directly bypasses staging fails or is structurally impossible.
- **CRITICAL**: Food vision output CANNOT directly create a medical warning. Verify that the `food_intake_candidates` table is ignored by the M6 rule matching engine.

## 3. Prescription Pipeline Tests
- **Valid Image**: Upload a high-quality prescription image. Verify extraction populates fields and identifies the drug via RxNorm.
- **Multiple Medications**: Upload a single image containing two distinct prescriptions. Verify two distinct candidates are staged.
- **Missing Fields**: Upload an image missing the start date. Verify the candidate's `start_date` is `null` and flagged as missing, not hallucinated.
- **Conflicting Extraction**: Simulate OCR returning "take 1 tablet" and "take 2 tablets". Verify confidence drops to `low` and UI blocks automatic confirmation.
- **RxNorm Match/No-Match**: Test extraction of a valid drug (Ibuprofen) vs an invalid drug string. Verify the invalid one demands manual patient mapping.

## 4. Food Vision Pipeline Tests
- **Clear Food Image**: Upload an image of a grapefruit. Verify candidate staged: "grapefruit".
- **Patient Modification**: Patient edits "grapefruit" to "orange". Verify canonical record saves "orange".
- **Patient Rejection**: Patient rejects "grapefruit". Verify candidate status is `rejected` and no canonical record is created.

## 5. Security & Isolation Tests
- **File Access Isolation**: Patient A uploads a prescription. Professional B (no connection) attempts to fetch the Storage URL. Verify 403 Forbidden.
- **Unconfirmed Extraction Claiming**: Patient A attempts to confirm Patient B's extraction candidate. Verify RLS/API throws `Unauthorized`.
- **Upload Limits**: Attempt to upload a 50MB PDF. Verify rejection at the API boundary.
- **Revoked Connections**: Professional with a `revoked` status in M2 attempts to run an extraction on the patient's past document. Verify `Unauthorized`.

## 6. Error & Edge Case Tests
- **Unreadable Image**: Upload a black square. Verify graceful fallback to manual entry prompt.
- **Provider Outage**: Simulate OCR service 503 error. Verify UI catches the exception gracefully.
