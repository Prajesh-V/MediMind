-- 20260903040000_m3_reminders_alerts.sql

-- 1. Database-enforced OCC for patients
ALTER TABLE patients ADD COLUMN alert_generation integer DEFAULT 1 NOT NULL;

-- 2. Enums
CREATE TYPE alert_audience AS ENUM ('PATIENT', 'PROFESSIONAL');
CREATE TYPE alert_source_type AS ENUM ('M6_INTERACTION', 'M7_SYMPTOM', 'M10_PATTERN', 'M9_STALE');
CREATE TYPE alert_status AS ENUM ('ACTIVE', 'RESOLVED_AUTO');
CREATE TYPE alert_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- 3. Table
CREATE TABLE system_alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    audience alert_audience NOT NULL,
    source_type alert_source_type NOT NULL,
    source_id text NOT NULL,
    status alert_status NOT NULL DEFAULT 'ACTIVE',
    priority alert_priority NOT NULL,
    snapshot jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at timestamptz,
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    
    UNIQUE(patient_id, audience, source_type, source_id)
);

-- 4. RLS Policies
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients select own alerts" ON system_alerts FOR SELECT 
USING (audience = 'PATIENT' AND patient_id = auth.uid());

CREATE POLICY "Professionals select connected alerts" ON system_alerts FOR SELECT 
USING (
    audience = 'PROFESSIONAL' AND 
    EXISTS (SELECT 1 FROM patient_professional_connections WHERE professional_id = auth.uid() AND patient_id = system_alerts.patient_id AND status = 'active')
);

CREATE POLICY "Deny insert" ON system_alerts FOR INSERT WITH CHECK (false);
CREATE POLICY "Deny update" ON system_alerts FOR UPDATE USING (false);
CREATE POLICY "Deny delete" ON system_alerts FOR DELETE USING (false);

-- 5. RPCs for reading/acknowledging
CREATE OR REPLACE FUNCTION mark_alert_read(p_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.id = p_alert_id 
        AND sa.status = 'ACTIVE'
        AND (
            (sa.audience = 'PATIENT' AND sa.patient_id = auth.uid()) OR
            (sa.audience = 'PROFESSIONAL' AND EXISTS (
                SELECT 1 FROM patient_professional_connections ppc 
                WHERE ppc.professional_id = auth.uid() AND ppc.patient_id = sa.patient_id AND ppc.status = 'active'
            ))
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized or alert not active';
    END IF;

    UPDATE system_alerts SET read_at = now() WHERE id = p_alert_id AND read_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION mark_alert_read(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_alert_read(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION acknowledge_alert(p_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM system_alerts sa
        WHERE sa.id = p_alert_id 
        AND sa.status = 'ACTIVE'
        AND (
            (sa.audience = 'PATIENT' AND sa.patient_id = auth.uid()) OR
            (sa.audience = 'PROFESSIONAL' AND EXISTS (
                SELECT 1 FROM patient_professional_connections ppc 
                WHERE ppc.professional_id = auth.uid() AND ppc.patient_id = sa.patient_id AND ppc.status = 'active'
            ))
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized or alert not active';
    END IF;

    UPDATE system_alerts SET acknowledged_at = now(), read_at = COALESCE(read_at, now()) WHERE id = p_alert_id AND acknowledged_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION acknowledge_alert(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION acknowledge_alert(uuid) TO authenticated;

-- 6. OCC Materializer RPC
CREATE OR REPLACE FUNCTION commit_patient_alerts(
    p_patient_id uuid,
    p_expected_generation integer,
    p_alerts_payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_current integer;
    v_alert_elem jsonb;
    v_source_type alert_source_type;
    v_source_id text;
    v_audience alert_audience;
    v_status alert_status;
    v_priority alert_priority;
    v_snapshot jsonb;
BEGIN
    -- 1. Acquire transaction-scoped advisory lock using a safe 64-bit cast of the UUID
    -- We take the first 16 hex chars of the patient_id (64 bits), convert to bit string, then to bigint.
    PERFORM pg_advisory_xact_lock(('x' || substr(replace(p_patient_id::text, '-', ''), 1, 16))::bit(64)::bigint);

    -- 2. Validate OCC generation
    SELECT alert_generation INTO v_current FROM patients WHERE id = p_patient_id;
    IF v_current != p_expected_generation THEN
        RAISE EXCEPTION 'Concurrency error: Stale generation (expected %, got %)', p_expected_generation, v_current;
    END IF;

    -- 3. Process the JSON array
    FOR v_alert_elem IN SELECT * FROM jsonb_array_elements(p_alerts_payload)
    LOOP
        v_source_type := (v_alert_elem->>'source_type')::alert_source_type;
        v_source_id := v_alert_elem->>'source_id';
        v_audience := (v_alert_elem->>'audience')::alert_audience;
        v_status := (v_alert_elem->>'status')::alert_status;
        v_priority := (v_alert_elem->>'priority')::alert_priority;
        v_snapshot := v_alert_elem->'snapshot';

        IF v_status = 'ACTIVE' THEN
            -- UPSERT logic per source
            IF v_source_type = 'M6_INTERACTION' OR v_source_type = 'M10_PATTERN' OR v_source_type = 'M9_STALE' THEN
                INSERT INTO system_alerts (patient_id, audience, source_type, source_id, status, priority, snapshot)
                VALUES (p_patient_id, v_audience, v_source_type, v_source_id, v_status, v_priority, v_snapshot)
                ON CONFLICT (patient_id, audience, source_type, source_id)
                DO UPDATE SET 
                    snapshot = EXCLUDED.snapshot,
                    status = 'ACTIVE',
                    resolved_at = NULL
                WHERE system_alerts.snapshot::text != EXCLUDED.snapshot::text 
                   OR system_alerts.status = 'RESOLVED_AUTO';
            ELSIF v_source_type = 'M7_SYMPTOM' THEN
                -- Static source. Only insert if missing, never update.
                INSERT INTO system_alerts (patient_id, audience, source_type, source_id, status, priority, snapshot)
                VALUES (p_patient_id, v_audience, v_source_type, v_source_id, v_status, v_priority, v_snapshot)
                ON CONFLICT DO NOTHING;
            END IF;
        ELSE
            -- RESOLVED_AUTO
            UPDATE system_alerts 
            SET status = 'RESOLVED_AUTO', resolved_at = COALESCE(resolved_at, now())
            WHERE patient_id = p_patient_id 
              AND audience = v_audience 
              AND source_type = v_source_type 
              AND source_id = v_source_id
              AND status = 'ACTIVE';
        END IF;
    END LOOP;

    -- 4. Increment generation atomically
    UPDATE patients SET alert_generation = alert_generation + 1 WHERE id = p_patient_id;
END;
$$;

-- Revoke execute from public. Service Role naturally bypasses this and can execute it.
REVOKE ALL ON FUNCTION commit_patient_alerts(uuid, integer, jsonb) FROM PUBLIC;
