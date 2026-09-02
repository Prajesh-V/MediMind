-- M9 Correction: Update PK and add atomic acknowledgment RPC

-- 1. Drop existing PK and recreate it with professional_id
ALTER TABLE public.clinical_acknowledgments
DROP CONSTRAINT clinical_acknowledgments_pkey;

ALTER TABLE public.clinical_acknowledgments
ADD PRIMARY KEY (patient_id, professional_id, assessment_id);

-- 2. Create the Atomic Acknowledgment RPC
CREATE OR REPLACE FUNCTION public.acknowledge_assessment_atomic(
    p_patient_id UUID,
    p_assessment_id TEXT,
    p_state_fingerprint TEXT,
    p_notes TEXT,
    p_trace_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prof_id UUID;
    v_has_connection BOOLEAN;
BEGIN
    -- 1. Authenticate Professional
    v_prof_id := auth.uid();
    IF v_prof_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: Must be authenticated';
    END IF;

    -- 2. Authorize Connection
    SELECT EXISTS (
        SELECT 1 FROM patient_professional_connections
        WHERE patient_id = p_patient_id
          AND professional_id = v_prof_id
          AND status = 'active'
    ) INTO v_has_connection;

    IF NOT v_has_connection THEN
        RAISE EXCEPTION 'Forbidden: No active connection with this patient';
    END IF;

    -- 3. Upsert into clinical_acknowledgments (M9 materialized state)
    INSERT INTO clinical_acknowledgments (
        patient_id, professional_id, assessment_id, state_fingerprint, acknowledged_at, notes
    )
    VALUES (
        p_patient_id, v_prof_id, p_assessment_id, p_state_fingerprint, now(), COALESCE(p_notes, 'Reviewed via Clinical Workspace')
    )
    ON CONFLICT (patient_id, professional_id, assessment_id)
    DO UPDATE SET
        state_fingerprint = EXCLUDED.state_fingerprint,
        acknowledged_at = EXCLUDED.acknowledged_at,
        notes = EXCLUDED.notes;

    -- 4. Insert trace event (Will throw 23505 if OCC hash collision occurs, rolling back the entire transaction!)
    INSERT INTO clinical_trace_events (
        patient_id,
        assessment_id,
        event_type,
        event_timestamp,
        actor_type,
        actor_id,
        source_component,
        source_version,
        metadata,
        previous_event_hash,
        event_hash
    ) VALUES (
        (p_trace_payload->>'patient_id')::UUID,
        p_trace_payload->>'assessment_id',
        p_trace_payload->>'event_type',
        (p_trace_payload->>'event_timestamp')::TIMESTAMPTZ,
        p_trace_payload->>'actor_type',
        (p_trace_payload->>'actor_id')::UUID,
        p_trace_payload->>'source_component',
        p_trace_payload->>'source_version',
        p_trace_payload->'metadata',
        p_trace_payload->>'previous_event_hash',
        p_trace_payload->>'event_hash'
    );

    RETURN jsonb_build_object('success', true);
END;
$$;
