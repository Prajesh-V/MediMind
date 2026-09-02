# M5: Prescription OCR Pipeline

## 1. Goal
Translate an uploaded prescription document (Image or PDF) into a structured array of medication candidates, normalized against RxNorm, staged for patient review via the existing M3 confirmation flow.

## 2. Pipeline Flow
1. **Upload**: User uploads a file. It is validated and securely stored in private Supabase Storage.
2. **Extraction Run**: An async or sync process hands the image to an OCR provider. 
3. **Structured Extraction**: The OCR attempts to extract the following attributes:
   - Medication name
   - Strength & Dosage Unit (e.g. 500 mg)
   - Dosage Form (e.g. tablet)
   - Route (e.g. oral)
   - Frequency (e.g. twice daily)
   - PRN Status (as needed)
   - Start Date / End Date
   - Prescribing doctor, facility, date.
4. **Normalization**: The extracted medication name is fed to the M4 RxNorm Adapter (`approximateTerm` search).
5. **Staging**: The candidate is inserted into the existing `prescription_candidates` table (or an extended `extraction_candidates` table).
6. **Patient Review**: The UI displays the extracted fields side-by-side with the uploaded image snippet. The patient can edit, accept, or reject the candidate.
7. **Activation**: Confirmation routes through the existing M3 pipeline, creating a confirmed `patient_medications` record and generating schedules.

## 3. Confidence Model
The extraction layer must preserve certainty boundaries:
- **High Confidence**: Fields cleanly extracted and strongly validated against RxNorm.
- **Low Confidence/Missing**: Explicitly flagged with a warning icon in the UI. E.g. "Frequency missing".
- **Conflicting Data**: If OCR sees multiple interpretations (e.g. "Take 1 or 2"), it drops to low confidence and demands patient intervention.
*The system must never guess missing fields.* If the start date is absent from the prescription, the extracted `start_date` is `null`.

## 4. UI/UX Requirements
- The UI MUST clearly frame the OCR output as an "Extraction Attempt." It is not medical truth.
- A split-screen or overlay interface where the source document is visible while editing the candidate fields is highly recommended.
- The UI must handle failure states safely: "Unable to read prescription. Please enter manually."

## 5. Error Handling
- **Blurry/Unreadable**: OCR failure leads to a user prompt for manual entry.
- **Service Timeout/Rate Limit**: Display error message, fallback to manual entry.
- **No Medications Found**: If the document is just a doctor's note with no Rx, reject the extraction run elegantly.
