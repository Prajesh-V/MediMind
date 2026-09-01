# Medical safety policy

## Hard invariant

The LLM is not MediMind's medical authority. Deterministic, versioned, evidence-linked MediMind rules are the only source of patient-facing interaction assessments.

## Evidence boundary

MVP uses RxNorm for normalization plus DailyMed and openFDA for U.S.-source label evidence. This is an explicit limitation for an India-first product. A medication without supported normalization/evidence must return `evidence_unavailable`, not an inferred answer.

## Rule execution gate

Only a rule with status `approved`, linked evidence, a recorded qualified-reviewer approval, and an effective date may execute for production patient output. M0 contains no such rule or approval.

## Causality and escalation

Food/dose timing identifies contextual relevance only. Safety reports and repeated patterns are review signals, never automatic clinical causality. Urgent or evidence-unavailable scenarios require clear professional escalation copy.
