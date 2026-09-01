# Product requirements

## Confirmed scope

MediMind is an India-first medication companion with patient and healthcare-professional experiences. Production starts with no health records. Patients create their own profile, medications, dose events, food records, and safety reports.

Patient capabilities eventually include prescription/manual medication entry, schedule and adherence tracking, food intake capture, deterministic interaction assessment, evidence-backed guidance, symptom/ADR reporting, settings, and tool-based AI explanations. Professional capabilities include access to approved connected patients, medication/adherence monitoring, interaction review, safety-report review, and non-diagnostic AI summaries.

## Access model

A patient generates a one-time, expiring connection code. A professional redeems it, creating a pending connection. The patient must approve it before professional access is active. The patient can revoke access; every action is audited.

## Non-goals for M0

- No application pages, authentication flow, persistence client, or external API calls.
- No production or demo patient records.
- No active patient-facing AI.
- No rule marked clinically approved.

## Product safety requirements

- Timing is an assessment aid and never proof of causality.
- The LLM cannot determine interactions, contraindications, dosage, diagnosis, treatment, severity, or evidence.
- Clinical assessments originate from deterministic approved MediMind rules linked to source evidence.
- Unsupported medication or unavailable evidence produces an explicit unavailable state and professional escalation.
