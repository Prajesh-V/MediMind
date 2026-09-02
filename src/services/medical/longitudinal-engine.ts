import crypto from 'crypto';
import type { 
  LongitudinalPattern, 
  LongitudinalPatternType, 
  ClinicalTraceEvent 
} from './types';

// Using standard cypto for deterministic SHA-256 state fingerprinting
function sha256Fingerprint(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Stable JSON serialization for canonical hashing
 */
function deterministicStringify(obj: any): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']';
  }
  
  const keys = Object.keys(obj).sort();
  const parts = keys.map(k => `"${k}":${deterministicStringify(obj[k])}`);
  return '{' + parts.join(',') + '}';
}

export interface DoseEventContext {
  id: string;
  patient_medication_id: string;
  status: 'pending' | 'taken' | 'late' | 'skipped' | 'missed';
  taken_at: string;
}

export interface AssessmentMetadata {
  rule_id: string;
  rule_version: string;
  state_fingerprint: string;
}

export interface TraceEventWithMetadata extends ClinicalTraceEvent {
  metadata: Record<string, any> & { assessment?: AssessmentMetadata };
}

export interface LongitudinalContext {
  patient_id: string;
  dose_events: DoseEventContext[];
  m6_assessments: {
    id: string;
    assessment_id: string;
    rule_id: string;
    rule_version: number;
    severity: string;
    state_fingerprint: string;
    first_seen_at: string;
    last_seen_at: string;
    source_medication_ids: string[] | null;
  }[];
}

/**
 * Deterministically evaluates historical data to produce Longitudinal Patterns.
 * Generates canonical fingerprints for accurate M9 stale review tracking.
 */
export function evaluateLongitudinalPatterns(context: LongitudinalContext): LongitudinalPattern[] {
  const patterns: LongitudinalPattern[] = [];
  const nowMs = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const observed_at = new Date(nowMs).toISOString();

  // ====================================================
  // 1. MISSED_DOSE_PATTERN & SKIPPED_DOSE_PATTERN
  // Window: 30 days (Evaluated as a 720-hour Rolling Duration Window)
  // Semantics: Absolute elapsed time (timezone and DST agnostic).
  // Threshold: >= 5 doses
  // ====================================================
  const window30DaysMs = 30 * DAY_MS;
  const missedDoseMap = new Map<string, DoseEventContext[]>();
  const skippedDoseMap = new Map<string, DoseEventContext[]>();

  for (const dose of context.dose_events) {
    const doseTimeMs = new Date(dose.taken_at).getTime();
    if (nowMs - doseTimeMs <= window30DaysMs) {
      if (dose.status === 'missed') {
        if (!missedDoseMap.has(dose.patient_medication_id)) {
          missedDoseMap.set(dose.patient_medication_id, []);
        }
        missedDoseMap.get(dose.patient_medication_id)!.push(dose);
      } else if (dose.status === 'skipped') {
        if (!skippedDoseMap.has(dose.patient_medication_id)) {
          skippedDoseMap.set(dose.patient_medication_id, []);
        }
        skippedDoseMap.get(dose.patient_medication_id)!.push(dose);
      }
    }
  }

  const processDoseMap = (map: Map<string, DoseEventContext[]>, patternType: LongitudinalPatternType) => {
    for (const [medId, doses] of map.entries()) {
      if (doses.length >= 5) {
        // Sort for deterministic fingerprinting (Authored time)
        doses.sort((a, b) => a.taken_at.localeCompare(b.taken_at));
        
        const first_event = doses[0].taken_at;
        const last_event = doses[doses.length - 1].taken_at;
        
        const source_dose_event_ids = doses.map(d => d.id).sort();

        const canonicalState = {
          pattern_type: patternType,
          pattern_definition_version: '1.0',
          observation_window_days: 30,
          threshold_value: 5,
          first_event_at: first_event,
          last_event_at: last_event,
          source_medication_ids: [medId],
          source_dose_event_ids
        };
        
        const pattern_fingerprint = sha256Fingerprint(deterministicStringify(canonicalState));

        patterns.push({
          id: crypto.randomUUID(),
          patient_id: context.patient_id,
          pattern_type: patternType,
          target_entity_id: medId,
          pattern_definition_version: '1.0',
          first_event_at: first_event,
          last_event_at: last_event,
          observed_at,
          observation_window_days: 30,
          threshold_value: 5,
          observation_count: doses.length,
          source_medication_ids: [medId],
          source_assessment_ids: null,
          source_dose_event_ids,
          source_dietary_record_ids: null,
          pattern_fingerprint
        });
      }
    }
  };

  processDoseMap(missedDoseMap, 'MISSED_DOSE_PATTERN');
  processDoseMap(skippedDoseMap, 'SKIPPED_DOSE_PATTERN');

  // ====================================================
  // 2. RECURRING_INTERACTION
  // Window: 90 days (Rolling Duration Window: 2160 hours)
  // Threshold: >= 3 unique generated assessments with the SAME rule_id
  // Constraint: Assessments must have different state_fingerprints!
  // ====================================================
  const window90DaysMs = 90 * DAY_MS;
  const interactionMap = new Map<string, typeof context.m6_assessments>();

  for (const assessment of context.m6_assessments) {
    const traceTimeMs = new Date(assessment.last_seen_at).getTime(); // Use last_seen_at for temporal window inclusion
    if (nowMs - traceTimeMs <= window90DaysMs) {
      const key = `${assessment.rule_id}_v${assessment.rule_version}`;
      if (!interactionMap.has(key)) {
        interactionMap.set(key, []);
      }
      interactionMap.get(key)!.push(assessment);
    }
  }

  for (const [key, rawAssessments] of interactionMap.entries()) {
    // Even though the DB enforces this, the engine remains purely deterministic
    // and filters to unique state_fingerprints just in case.
    const uniqueMap = new Map<string, typeof context.m6_assessments[0]>();
    for (const a of rawAssessments) {
      if (!uniqueMap.has(a.state_fingerprint)) {
        uniqueMap.set(a.state_fingerprint, a);
      } else {
        // If we see a duplicate, ensure we keep the oldest first_seen_at and newest last_seen_at
        const existing = uniqueMap.get(a.state_fingerprint)!;
        if (new Date(a.first_seen_at) < new Date(existing.first_seen_at)) existing.first_seen_at = a.first_seen_at;
        if (new Date(a.last_seen_at) > new Date(existing.last_seen_at)) existing.last_seen_at = a.last_seen_at;
      }
    }

    const assessments = Array.from(uniqueMap.values());

    if (assessments.length >= 3) {
      // Sort for deterministic fingerprinting by first_seen_at
      assessments.sort((a, b) => a.first_seen_at.localeCompare(b.first_seen_at));
      
      const first_event = assessments[0].first_seen_at;
      // For last event we want the latest last_seen_at
      const last_event = [...assessments].sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0].last_seen_at;

      const assessmentIds = assessments.map(a => a.assessment_id);
      assessmentIds.sort();

      const canonicalState = {
        pattern_type: 'RECURRING_INTERACTION',
        pattern_definition_version: '1.0',
        observation_window_days: 90,
        threshold_value: 3,
        first_event_at: first_event,
        last_event_at: last_event,
        rule_key: key,
        source_assessment_ids: assessmentIds
      };

      const pattern_fingerprint = sha256Fingerprint(deterministicStringify(canonicalState));
      const target_entity_id = assessments[0].rule_id; // Identity focus

      patterns.push({
        id: crypto.randomUUID(),
        patient_id: context.patient_id,
        pattern_type: 'RECURRING_INTERACTION',
        target_entity_id,
        pattern_definition_version: '1.0',
        first_event_at: first_event,
        last_event_at: last_event,
        observed_at,
        observation_window_days: 90,
        threshold_value: 3,
        observation_count: assessments.length,
        source_medication_ids: null,
        source_assessment_ids: assessmentIds.length > 0 ? assessmentIds : null,
        source_dose_event_ids: null,
        source_dietary_record_ids: null,
        pattern_fingerprint
      });
    }
  }

  return patterns;
}

/**
 * Persists detected longitudinal patterns to the database.
 * Upserts based on (patient_id, pattern_type, target_entity_id) stable identity constraint.
 * Emits LONGITUDINAL_PATTERN_DETECTED trace for novel patterns.
 * Emits LONGITUDINAL_PATTERN_STATE_CHANGED when a fingerprint mutates.
 */
export async function persistLongitudinalPatterns(
  supabaseService: any,
  patterns: LongitudinalPattern[]
): Promise<void> {
  const { prepareTracePayload } = require('./trace'); 

  for (const pattern of patterns) {
    const { data: existing, error: checkErr } = await supabaseService
      .from('longitudinal_patterns')
      .select('id, pattern_fingerprint')
      .eq('patient_id', pattern.patient_id)
      .eq('pattern_type', pattern.pattern_type)
      .eq('target_entity_id', pattern.target_entity_id)
      .maybeSingle();

    if (checkErr) {
      console.error('Error checking existing pattern:', checkErr);
      continue;
    }

    if (existing) {
      if (existing.pattern_fingerprint === pattern.pattern_fingerprint) {
        // Idempotent: No state mutation. No DB update, no trace spam.
        continue;
      }

      // Fingerprint Mutated: Update the existing logical series atomically
      const traceInput = {
        patient_id: pattern.patient_id,
        event_type: 'LONGITUDINAL_PATTERN_STATE_CHANGED',
        actor_type: 'system',
        source_component: 'M10_Longitudinal_Engine',
        source_version: '1.0.0',
        metadata: {
          pattern_id: existing.id,
          pattern_type: pattern.pattern_type,
          previous_fingerprint: existing.pattern_fingerprint,
          new_fingerprint: pattern.pattern_fingerprint
        }
      };

      const maxAttempts = 3;
      let attempt = 0;
      let success = false;

      while (attempt < maxAttempts && !success) {
        attempt++;
        try {
          const event_timestamp = new Date().toISOString();
          const tracePayload = await prepareTracePayload(supabaseService, traceInput, event_timestamp);

          const { error: rpcErr } = await supabaseService.rpc('materialize_longitudinal_pattern_atomic', {
            p_pattern: { ...pattern, id: existing.id },
            p_trace_payload: tracePayload,
            p_mutation_type: 'CHANGED'
          });

          if (!rpcErr) {
            success = true;
          } else if (rpcErr.code === '23505') {
            // OCC Collision on M8 Trace. Retry.
            if (attempt === maxAttempts) console.error('Max OCC retries reached for pattern update');
          } else {
            console.error('Failed to update pattern atomically:', rpcErr);
            break;
          }
        } catch (e) {
          console.error('Exception during pattern atomic update:', e);
          break;
        }
      }

    } else {
      // Novel Detection: Insert new logical pattern series atomically
      const traceInput = {
        patient_id: pattern.patient_id,
        event_type: 'LONGITUDINAL_PATTERN_DETECTED',
        actor_type: 'system',
        source_component: 'M10_Longitudinal_Engine',
        source_version: '1.0.0',
        metadata: {
          pattern_id: pattern.id, // we pre-generate this in the engine
          pattern_type: pattern.pattern_type,
          pattern_fingerprint: pattern.pattern_fingerprint
        }
      };

      const maxAttempts = 3;
      let attempt = 0;
      let success = false;

      while (attempt < maxAttempts && !success) {
        attempt++;
        try {
          const event_timestamp = new Date().toISOString();
          const tracePayload = await prepareTracePayload(supabaseService, traceInput, event_timestamp);

          const { error: rpcErr } = await supabaseService.rpc('materialize_longitudinal_pattern_atomic', {
            p_pattern: pattern,
            p_trace_payload: tracePayload,
            p_mutation_type: 'NEW'
          });

          if (!rpcErr) {
            success = true;
          } else if (rpcErr.code === '23505') {
            // OCC Collision
            if (attempt === maxAttempts) console.error('Max OCC retries reached for pattern insert');
          } else {
            console.error('Failed to insert pattern atomically:', rpcErr);
            break; // Non-OCC error, do not retry
          }
        } catch (e) {
          console.error('Exception during pattern atomic insert:', e);
          break;
        }
      }
    }
  }
}
