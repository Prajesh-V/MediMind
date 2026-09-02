-- M9: Professional Clinical Workspace Acknowledgments

CREATE TABLE public.clinical_acknowledgments (
    patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assessment_id TEXT NOT NULL,
    state_fingerprint TEXT NOT NULL,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (patient_id, assessment_id)
);

ALTER TABLE public.clinical_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Professionals can read and write acknowledgments for their connected patients
CREATE POLICY "Professionals can manage acknowledgments for connected patients"
ON public.clinical_acknowledgments
FOR ALL
TO authenticated
USING (
    professional_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM patient_professional_connections ppc
        WHERE ppc.patient_id = clinical_acknowledgments.patient_id
        AND ppc.professional_id = auth.uid()
        AND ppc.status = 'active'
    )
)
WITH CHECK (
    professional_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM patient_professional_connections ppc
        WHERE ppc.patient_id = clinical_acknowledgments.patient_id
        AND ppc.professional_id = auth.uid()
        AND ppc.status = 'active'
    )
);

-- Patients can read their own acknowledgments
CREATE POLICY "Patients can view their own acknowledgments"
ON public.clinical_acknowledgments
FOR SELECT
TO authenticated
USING (patient_id = auth.uid());
