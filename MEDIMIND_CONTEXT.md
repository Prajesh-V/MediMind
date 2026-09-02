# MediMind Context & Technical Overview

## 1. Project Mission
MediMind is an AI-assisted personalized medication and healthcare companion designed to safely connect:
- Prescriptions & Medication Schedules
- Dose Adherence & Tracking
- Food Intake & Drug-Food Interaction Assessments
- Deterministic Clinical Rule Governance
- Healthcare Professional Remote Monitoring

## 2. Architectural Pillars
1. **Clinical Authority First**: Authoritative databases (RxNorm, DailyMed, openFDA) serve as the grounding truth for medication identities and interaction warnings. AI is strictly assistive for summarization and insights, never authoritative.
2. **Canonical Data Pipeline**: All medication records follow the identical pathway: Data Extraction/Input -> RxNorm Normalization -> Explicit Patient Review & Confirmation -> Active Regimen.
3. **Strict Zero-Trust Security**: Deny-by-default Row Level Security (RLS) on all patient health data. Healthcare professionals access patient records strictly through approved, active two-way connection handshakes.
4. **Deterministic Auditing**: All clinical mutations and connection changes log immutable audit events to `public.audit_log`.

## 3. Milestones Overview
- **M0**: Architecture, reference preservation, migration scaffolds, source adapter contracts. *(Completed)*
- **M1**: Next.js App Router UI foundation, Design System, Localization, Zero-data empty states. *(Completed)*
- **M2**: Supabase Auth, Profiles, Patient-Professional Connection Handshake (Code generation/redemption/approval), RLS policies. *(Completed & Verified)*
- **M3**: Medications, RxNorm Normalization, Prescriptions & Candidate Staging, Timezone-aware Schedules, Dose Events, Adherence. *(Completed & Verified)*
- **M4**: Medical-source adapters, evidence models, and interaction rule governance engine. *(Completed & Verified)*
- **M5**: Multimodal Intake (Prescription OCR and Food Vision). *(Completed)*
- **M6**: Deterministic medical interaction engine. *(Completed)*
- **M7–M10**: Future milestones for Gemini AI explanation, safety reporting, and production deployment.

*Note: M6 is a purely deterministic engine. Gemini is strictly used for observational multimodal extraction in M5 and not for clinical decision making. The medical_knowledge schema remains strictly private, with approved interaction rules accessed only through controlled RPCs.*
