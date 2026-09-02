import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import type { TraceEventType, ClinicalTraceEvent } from './types';

// Ensure node crypto is available in edge/serverless if needed
if (!global.crypto) {
  global.crypto = crypto as any;
}

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

export interface TraceEventInput {
  patient_id: string;
  assessment_id?: string | null;
  event_type: TraceEventType;
  actor_type: 'patient' | 'professional' | 'system';
  actor_id?: string | null;
  source_component: string;
  source_version: string;
  metadata: Record<string, any>;
}

export async function prepareTracePayload(
  supabaseService: any,
  input: TraceEventInput,
  event_timestamp: string
): Promise<Omit<ClinicalTraceEvent, 'id' | 'created_at'>> {
  // 1. Fetch previous event hash for this patient (append-only ledger per patient)
  const { data: lastEvent, error: fetchErr } = await supabaseService
    .from('clinical_trace_events')
    .select('event_hash')
    .eq('patient_id', input.patient_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') {
    throw new Error('Trace integrity check failed');
  }

  const previous_event_hash = lastEvent?.event_hash || GENESIS_HASH;

  // 2. Deterministic Canonical Serialization
  const canonicalMetadata = deterministicStringify(input.metadata);
  
  const canonicalPayload = [
    input.patient_id,
    input.assessment_id || '',
    input.event_type,
    event_timestamp,
    input.actor_type,
    input.actor_id || '',
    input.source_component,
    input.source_version,
    canonicalMetadata
  ].join('|');

  // 3. Hash calculation: SHA-256(previous_event_hash + canonical_current_event)
  const hashInput = previous_event_hash + '|' + canonicalPayload;
  
  let event_hash: string;
  if (typeof crypto.subtle !== 'undefined') {
    const encoder = new TextEncoder();
    const data = encoder.encode(hashInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    event_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } else {
    event_hash = crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  // 4. Construct Event
  return {
    patient_id: input.patient_id,
    assessment_id: input.assessment_id,
    event_type: input.event_type,
    event_timestamp,
    actor_type: input.actor_type,
    actor_id: input.actor_id,
    source_component: input.source_component,
    source_version: input.source_version,
    metadata: input.metadata,
    previous_event_hash,
    event_hash
  };
}

/**
 * Appends a new tamper-evident trace event to the clinical trace ledger.
 */
export async function recordTraceEvent(
  supabaseService: any,
  input: TraceEventInput
): Promise<ClinicalTraceEvent> {
  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const event_timestamp = new Date().toISOString();
      const traceEvent = await prepareTracePayload(supabaseService, input, event_timestamp);

      // 5. Insert (using service role key)
      const { data: inserted, error: insertErr } = await supabaseService
        .from('clinical_trace_events')
        .insert(traceEvent)
        .select()
        .single();

      if (insertErr) {
        // OCC Violation: Postgres unique constraint 23505
        if (insertErr.code === '23505' && insertErr.message.includes('clinical_trace_events_patient_prev_hash_key')) {
          if (attempt < maxAttempts) {
            console.log(`Trace OCC collision for patient ${input.patient_id}, retrying attempt ${attempt + 1}...`);
            continue; // Retry
          }
        }
        console.error('Failed to append trace event:', insertErr);
        throw new Error('Trace write failed');
      }

      return inserted as ClinicalTraceEvent;
    } catch (err: any) {
      if (attempt >= maxAttempts) {
        throw err;
      }
    }
  }

  throw new Error('Max retries exceeded for trace write');
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
