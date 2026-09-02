-- M7: Patient Symptom Reports
CREATE TABLE public.patient_symptom_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    symptom TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('mild', 'moderate', 'severe')),
    onset_at TIMESTAMPTZ NOT NULL,
    related_medication_id UUID REFERENCES public.patient_medications(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_patient_symptom_reports_patient_id ON public.patient_symptom_reports(patient_id);

-- Row Level Security
ALTER TABLE public.patient_symptom_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Patients can manage their own reports
CREATE POLICY "Patients can view their own symptom reports"
ON public.patient_symptom_reports FOR SELECT
TO authenticated
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can create their own symptom reports"
ON public.patient_symptom_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = patient_id);

-- Policy: Professionals can view connected patients' reports
CREATE POLICY "Professionals can view symptom reports of connected patients"
ON public.patient_symptom_reports FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.patient_professional_connections
        WHERE patient_professional_connections.professional_id = auth.uid()
        AND patient_professional_connections.patient_id = patient_symptom_reports.patient_id
        AND patient_professional_connections.status = 'active'
    )
);

-- Add update trigger for updated_at
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.patient_symptom_reports
  FOR EACH ROW EXECUTE PROCEDURE moddatetime(updated_at);
