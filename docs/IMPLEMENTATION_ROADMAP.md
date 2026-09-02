# Implementation roadmap

## M0 — architecture foundation

Documentation, conventions, environment template, reference-artifact preservation, migration scaffold, source-adapter contracts, and rule governance only.

**Definition of done:** no application feature, patient data, production rule, clinical approval, or Gemini flow exists.

## M1-M10

1. M1: Next.js shell, reference UX translation, design system, routing, i18n scaffolding. [COMPLETED]
2. M2: Auth, profiles, patient-professional connection workflow, RLS. [COMPLETED & VERIFIED]
3. M3: Medication search & RxNorm normalization, manual entry, prescription candidate staging, confirmation pipeline, timezone-aware schedules, dose events, adherence calculations, professional monitoring. [COMPLETED & VERIFIED]
4. M4: Medical-source adapters, evidence models, and interaction rule governance engine. [COMPLETED]
5. M5: Multimodal Intake (Prescription OCR and Food Vision pipeline). [COMPLETED]
6. M6: Deterministic medical interaction engine. [COMPLETED]
7. M7: Controlled Gemini Explanation/AI Layer. [NEXT]
8. M8: Preferences, in-app notifications/reminders, accessibility, security hardening. [PLANNED]
9. M9: End-to-end integration testing, performance optimization, and staging verification.
10. M10: Production deployment, telemetry verification, and final compliance audit.ness review.

No milestone begins until the preceding definition of done is met.
