'use server';

import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { authorizePatientAccess } from './connection';
import { getPatientActiveMedications } from './medication';
import { matchesMedicationSelector } from '@/services/medical/interaction-engine';
import { DatabaseInteractionRule, PatientMedicationContext } from '@/services/medical/types';

export interface SeparationRule {
  rule_key: string;
  mechanism: string;
  recommendation: string;
  severity: string;
}

export interface MedicationAdministrationGuidance {
  medication_id: string;
  rxcui: string | null;
  display_name: string;
  food_relation: string;
  administration_instructions: string | null;
  separation_rules: SeparationRule[];
}

/**
 * Retrieves authoritative administration guidance for a patient's active medications.
 * Maps medication metadata and governed separation rules.
 */
export async function getPatientAdministrationGuidance(patientId?: string): Promise<MedicationAdministrationGuidance[]> {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) throw new Error('Unauthorized');
  
  const targetPatientId = patientId || user.id;
  await authorizePatientAccess(targetPatientId);

  // 1. Fetch Patient Active Medications
  const meds = await getPatientActiveMedications(targetPatientId);

  if (meds.length === 0) {
    return [];
  }

  // 2. Format Context for Selector Matching
  const activeMedications: PatientMedicationContext[] = meds.map((m: any) => ({
    id: m.id,
    rxcui: m.rxcui,
    display_name: m.display_name,
    generic_name: m.generic_name,
    food_relation: m.food_relation || 'no_relation',
    administration_instructions: m.administration_instructions,
    schedules: m.medication_schedules || [],
  }));

  // 3. Fetch Approved Interaction Rules via secure RPC
  const { data: rules, error: rulesErr } = await supabase.rpc('get_approved_interaction_rules');
  if (rulesErr) {
    console.error('Error fetching interaction rules for guidance:', rulesErr);
    throw new Error('Failed to load clinical rules');
  }

  const databaseRules = (rules || []) as unknown as DatabaseInteractionRule[];
  
  // Only interested in rules with separation temporal logic
  const separationRules = databaseRules.filter(r => r.temporal_logic && r.temporal_logic.type === 'separation');

  // 4. Map guidance to medications
  const guidanceMap: Record<string, MedicationAdministrationGuidance> = {};

  // Initialize map with medication metadata
  for (const med of activeMedications) {
    guidanceMap[med.id] = {
      medication_id: med.id,
      rxcui: med.rxcui,
      display_name: med.display_name,
      food_relation: med.food_relation,
      administration_instructions: med.administration_instructions || null,
      separation_rules: [],
    };
  }

  // 5. Apply Separation Rules matching
  for (const rule of separationRules) {
    const { matches, matchingMeds } = matchesMedicationSelector(activeMedications, rule);
    if (matches) {
      for (const matchedMed of matchingMeds) {
        if (guidanceMap[matchedMed.id]) {
          // Avoid duplicates if a rule matches multiple ways
          const existing = guidanceMap[matchedMed.id].separation_rules.find(sr => sr.rule_key === rule.rule_key);
          if (!existing) {
            guidanceMap[matchedMed.id].separation_rules.push({
              rule_key: rule.rule_key,
              mechanism: rule.mechanism,
              recommendation: rule.recommendation_template,
              severity: rule.severity,
            });
          }
        }
      }
    }
  }

  return Object.values(guidanceMap);
}
