import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

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

const patient_id = '11111111-1111-1111-1111-111111111111';
const symptom_id = '22222222-2222-2222-2222-222222222222';
const symptom = 'Headache with "quotes"';
const severity = 'mild';
const timestamp = '2026-09-03T12:00:00.000Z';
const prev_hash = '0000000000000000000000000000000000000000000000000000000000000000';

const meta = {
  symptom_report_id: symptom_id,
  symptom: symptom,
  severity: severity
};

const canonicalMeta = deterministicStringify(meta);

const canonicalPayload = [
  patient_id,
  '', // assessment_id
  'PATIENT_OBSERVATION_REPORTED',
  timestamp,
  'patient',
  patient_id, // actor_id
  'SymptomReportForm',
  '1.0.0',
  canonicalMeta
].join('|');

const hashInput = prev_hash + '|' + canonicalPayload;
const hash = crypto.createHash('sha256').update(hashInput).digest('hex');

console.log('JS Meta:', canonicalMeta);
console.log('JS Hash Input:', hashInput);
console.log('JS Hash:', hash);
