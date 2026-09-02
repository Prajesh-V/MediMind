# M5: Multimodal Intake

## 1. Goal
Create a unified multimodal intake layer capable of processing unstructured images and documents (prescriptions, food images) and converting them into structured, reviewable candidates. The output is **always** treated as probabilistic extraction, requiring explicit patient confirmation before becoming canonical deterministic facts in the system.

## 2. The Golden Invariant
```text
IMAGE/DOCUMENT
      ↓
EXTRACTION (Vision / OCR)
      ↓
STRUCTURED CANDIDATE
      ↓
NORMALIZATION (e.g. RxNorm mapping)
      ↓
PATIENT REVIEW & CONFIRMATION
      ↓
CONFIRMED DATA
```
Extraction must **NEVER** directly create an active medication or trigger a clinical interaction warning. It only populates a candidate pipeline.

## 3. Scope
- **Part A: Prescription OCR**: Ingest images or PDFs of prescriptions, extract medication attributes (name, dosage, frequency), normalize via RxNorm, and stage for patient confirmation using the existing M3 pipeline.
- **Part B: Food Image Intake**: Ingest food images, identify candidate components (e.g., grapefruit, dairy), and stage for patient confirmation before evaluation by the deterministic engine (M6).

## 4. Separation of Concerns
- **Vision/OCR**: Strictly an information extraction tool. Does not make medical decisions.
- **Deterministic Engine (M6)**: Consumes confirmed data and matches it against approved rules.
- **AI/LLM (M7/M8)**: Explains the deterministic output in natural language. LLMs are NOT permitted to bridge vision straight to clinical decisions.

## 5. Security & Privacy Model
- **Secure Upload**: Prescriptions are Protected Health Information (PHI). Uploads must be stored securely using private Supabase Storage buckets, heavily constrained by Row-Level Security (RLS).
- **Access Limits**: Only the patient who uploaded the document, and professionals with an **active** connection in M2, may view the raw source files or their extractions. No public URLs.
- **File Management**: Strict file size (e.g., 5MB limit) and type (`image/jpeg`, `image/png`, `application/pdf`) validation on the server.
