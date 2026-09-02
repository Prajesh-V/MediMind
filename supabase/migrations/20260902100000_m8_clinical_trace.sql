-- M8: Clinical Traceability Events Table
CREATE TABLE public.clinical_trace_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    assessment_id TEXT,
    event_type TEXT NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_type TEXT NOT NULL CHECK (actor_type IN ('patient', 'professional', 'system')),
    actor_id UUID,
    source_component TEXT NOT NULL,
    source_version TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    previous_event_hash TEXT NOT NULL,
    event_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_trace_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own traces"
ON public.clinical_trace_events
FOR SELECT
TO authenticated
USING (auth.uid() = patient_id);

CREATE POLICY "Professionals view traces of connected patients"
ON public.clinical_trace_events
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.patient_professional_connections
        WHERE patient_professional_connections.professional_id = auth.uid()
        AND patient_professional_connections.patient_id = clinical_trace_events.patient_id
        AND patient_professional_connections.status = 'active'
    )
);

CREATE POLICY "Service Role Full Access"
ON public.clinical_trace_events
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
