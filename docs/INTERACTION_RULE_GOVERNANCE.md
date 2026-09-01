# Interaction-rule governance

## Lifecycle

```text
draft -> submitted -> approved -> retired
             |             |
             +-> draft     +-> retired
```

- **Draft:** development/review work only; cannot execute for production output.
- **Submitted:** immutable candidate version awaiting qualified clinical review; cannot execute for production output.
- **Approved:** requires linked evidence, qualified reviewer record, approval timestamp, and effective date; may execute only after all checks pass.
- **Retired:** preserved for historical traceability; cannot execute for new evaluations.

A review rejection returns a submitted candidate to `draft` for correction; rejection is captured as a review decision rather than a separate execution state.

## Required governance evidence

Every candidate must identify the medication selector, food/component selector, severity, deterministic temporal/exposure logic, mechanism/effect language, recommendation template, source URLs/identifiers, and version. An actual clinician or qualified review body must provide the reviewer identity, credential reference, decision, and timestamp before production approval.

## M0 status

The schema and contracts support this workflow. M0 creates no rule rows, no evidence rows, no review rows, and no clinical approval.
