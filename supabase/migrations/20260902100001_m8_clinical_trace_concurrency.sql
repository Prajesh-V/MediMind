-- M8 Final: Enforce append-only linearity for clinical trace events
ALTER TABLE public.clinical_trace_events 
ADD CONSTRAINT clinical_trace_events_patient_prev_hash_key 
UNIQUE (patient_id, previous_event_hash);
