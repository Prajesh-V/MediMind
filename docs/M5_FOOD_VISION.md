# M5: Food Image Vision Pipeline

## 1. Goal
Provide a workflow to take or upload images of food/meals, analyze them for dietary components using a vision model, and stage the *probabilistic* candidates for explicit patient confirmation. Confirmed components are passed to the deterministic engine (M6) to check for interactions against active medications.

## 2. Core Separation of Concepts
M3 established `food_relation` (e.g., "with food", "empty stomach"). This is a **medication instruction**, not a dietary identity.
M5 introduces **Food Components**: distinct dietary identities (e.g., "grapefruit", "dairy", "caffeine", "high-vitamin-K") that the patient is currently consuming or planning to consume.

## 3. Pipeline Flow
1. **Upload/Capture**: User uploads a food image.
2. **Vision Analysis**: The image is sent to an extraction service (e.g., Gemini Vision API, strictly in extraction mode).
3. **Candidate Identification**: The service returns an array of possible dietary components and a confidence score.
   - *Constraint*: It does NOT produce an unrestricted knowledge graph. It maps identified objects to a controlled list of candidate components relevant to interaction engines (e.g. mapping a picture of a latte to `caffeine`, `dairy`).
4. **Staging**: The probabilistic candidates are presented to the patient. E.g. "We detected: Dairy (High Confidence), Grapefruit (Low Confidence)."
5. **Patient Review**: The patient MUST confirm, edit, reject, or manually add components.
6. **Confirmation**: Only confirmed components become canonical `patient_dietary_intake` records.
7. **M6 Handoff**: The confirmed intake record triggers an M6 assessment against the patient's medications.

## 4. Safety & Uncertainty Boundary
The vision model must **never** make a clinical decision.
- It cannot say: "Do not eat this grapefruit, it interacts with your statin."
- It can only say: "Detected: Grapefruit."
- The subsequent deterministic assessment (M6) takes the confirmed "Grapefruit" entity and matches it against an approved M4 rule to produce the warning.

## 5. UI/UX Requirements
- Clearly communicate that vision analysis is a "guess."
- Provide easy one-tap confirmation or rejection chips for detected components.
- Include a manual search fallback if the vision model completely fails to identify the meal correctly.
