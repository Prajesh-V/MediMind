import crypto from 'crypto';
import {
  PatientEvaluationContext,
  DatabaseInteractionRule,
  InteractionAssessment,
  EvidenceReference,
  SeverityLevel,
  InteractionType,
  PatientMedicationContext,
} from './types';

const SEVERITY_WEIGHTS: Record<SeverityLevel, number> = {
  high: 3,
  moderate: 2,
  low: 1,
};

/**
 * Deterministically generates a consistent assessment ID from input parameters.
 */
function generateDeterministicAssessmentId(
  patientId: string,
  ruleId: string,
  medicationIds: string[]
): string {
  const sortedMeds = [...medicationIds].sort().join(':');
  const rawKey = `${patientId}|${ruleId}|${sortedMeds}`;
  
  // Simple deterministic hash conversion for UUID-like format
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    const char = rawKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return `det-${hex}-${ruleId.slice(0, 8)}-${ruleId.slice(9, 13)}`;
}

/**
 * Synchronous SHA-256 for state fingerprinting
 */
function sha256Fingerprint(str: string): string {
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * Parses time string 'HH:MM:SS' or 'HH:MM' into minutes from midnight.
 */
function parseTimeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Checks separation difference between two dose schedule times.
 */
function getHourDifference(timeA: string, timeB: string): number {
  const minA = parseTimeToMinutes(timeA);
  const minB = parseTimeToMinutes(timeB);
  const diffMinutes = Math.abs(minA - minB);
  // Also account for circular 24-hour wrap around
  const circularMinutes = Math.min(diffMinutes, 1440 - diffMinutes);
  return circularMinutes / 60;
}

/**
 * Pure deterministic helper to evaluate if a rule's medication selector matches the patient's active medications.
 */
export function matchesMedicationSelector(
  activeMedications: PatientMedicationContext[],
  rule: DatabaseInteractionRule
): { matches: boolean; matchingMeds: PatientMedicationContext[] } {
  let matchesMedication = false;
  const matchingMeds: PatientMedicationContext[] = [];

  const medSelector = rule.medication_selector;
  if (medSelector && medSelector.entities && medSelector.entities.length > 0) {
    const requiredEntities = medSelector.entities;

    if (medSelector.type === 'exact_rxcui') {
      const matchedEntitySet = new Set<string>();

      for (const entity of requiredEntities) {
        const matchingMed = activeMedications.find(
          (m) => m.rxcui && m.rxcui.trim() === entity.trim()
        );
        if (matchingMed) {
          matchedEntitySet.add(entity);
          if (!matchingMeds.some((m) => m.id === matchingMed.id)) {
            matchingMeds.push(matchingMed);
          }
        }
      }

      if (medSelector.condition === 'ALL') {
        matchesMedication = matchedEntitySet.size === requiredEntities.length;
      } else {
        matchesMedication = matchedEntitySet.size > 0;
      }
    } else if (medSelector.type === 'ingredient') {
      const matchedEntitySet = new Set<string>();

      for (const entity of requiredEntities) {
        const normEntity = entity.toLowerCase().trim();
        const matchingMed = activeMedications.find((m) => {
          const generic = m.generic_name?.toLowerCase() || '';
          const display = m.display_name.toLowerCase();
          return generic.includes(normEntity) || display.includes(normEntity);
        });

        if (matchingMed) {
          matchedEntitySet.add(entity);
          if (!matchingMeds.some((m) => m.id === matchingMed.id)) {
            matchingMeds.push(matchingMed);
          }
        }
      }

      if (medSelector.condition === 'ALL') {
        matchesMedication = matchedEntitySet.size === requiredEntities.length;
      } else {
        matchesMedication = matchedEntitySet.size > 0;
      }
    }
  } else {
    // Rule has no medication selector (matches all medications if food/timing applies)
    matchesMedication = true;
  }

  return { matches: matchesMedication, matchingMeds };
}

/**
 * Pure deterministic interaction evaluation engine.
 * STRICT INVARIANT: Contains zero LLM reasoning. All clinical assertions originate
 * directly from approved governance rules.
 */
export function evaluatePatientInteractions(
  context: PatientEvaluationContext,
  rules: DatabaseInteractionRule[],
  evaluationDate: Date = new Date()
): InteractionAssessment[] {
  const assessments: InteractionAssessment[] = [];

  // Filter rules to strictly approved and active in the validity window
  const activeRules = rules.filter((rule) => {
    if (rule.status !== 'approved') return false;
    if (rule.effective_from && new Date(rule.effective_from) > evaluationDate) return false;
    if (rule.effective_until && new Date(rule.effective_until) < evaluationDate) return false;
    return true;
  });

  const activeMedications = context.medications;
  if (activeMedications.length === 0) {
    return [];
  }

  for (const rule of activeRules) {
    const selectorResult = matchesMedicationSelector(activeMedications, rule);
    const matchesMedication = selectorResult.matches;
    const matchingMeds = selectorResult.matchingMeds;

    if (!matchesMedication) {
      continue;
    }

    // 2. Evaluate Food Component Selector
    let matchesFood = false;
    const matchingFoodComponents: string[] = [];
    const foodSelector = rule.food_component_selector;

    if (foodSelector && foodSelector.components && foodSelector.components.length > 0) {
      const targetComponents = foodSelector.components.map((c) => c.toLowerCase().trim());
      const confirmedFoodItems = (context.dietary_records || []).map((d) =>
        d.component_name.toLowerCase().trim()
      );

      for (const component of targetComponents) {
        // Check if patient confirmed intake of component
        const hasIntake = confirmedFoodItems.some(
          (item) => item.includes(component) || component.includes(item)
        );

        // Also check if medication food_relation explicitly matches
        const hasMedRelation = matchingMeds.some((m) => {
          if (component === 'empty_stomach' && m.food_relation === 'empty_stomach') return true;
          if (component === 'with_meal' && m.food_relation === 'with_meal') return true;
          if (component === 'before_meal' && m.food_relation === 'before_meal') return true;
          if (component === 'after_meal' && m.food_relation === 'after_meal') return true;
          if (m.administration_instructions?.toLowerCase().includes(component)) return true;
          return false;
        });

        if (hasIntake || hasMedRelation) {
          matchingFoodComponents.push(component);
        }
      }

      if (foodSelector.condition === 'ALL') {
        matchesFood = matchingFoodComponents.length === targetComponents.length;
      } else {
        matchesFood = matchingFoodComponents.length > 0;
      }

      // If rule specifies food components but none matched, rule does not fire
      if (!matchesFood) {
        continue;
      }
    }

    // 3. Evaluate Temporal Logic / Separation
    let isTimingViolation = false;
    let hasSchedules = false;
    const temporalLogic = rule.temporal_logic;

    if (
      temporalLogic &&
      temporalLogic.type === 'separation' &&
      typeof temporalLogic.min_hours_separation === 'number'
    ) {
      const minHours = temporalLogic.min_hours_separation;

      // Check pairs of matching medications
      if (matchingMeds.length >= 2) {
        let allHaveSchedules = true;
        for (let i = 0; i < matchingMeds.length; i++) {
          for (let j = i + 1; j < matchingMeds.length; j++) {
            const medA = matchingMeds[i];
            const medB = matchingMeds[j];

            const schedulesA = medA.schedules || [];
            const schedulesB = medB.schedules || [];

            if (schedulesA.length === 0 || schedulesB.length === 0) {
              allHaveSchedules = false;
              continue;
            }

            hasSchedules = true;
            for (const sA of schedulesA) {
              for (const sB of schedulesB) {
                const diff = getHourDifference(sA.time_of_day, sB.time_of_day);
                if (diff < minHours) {
                  isTimingViolation = true;
                  break;
                }
              }
              if (isTimingViolation) break;
            }
          }
        }

        // If schedules exist for both and no timing violation occurs, this timing rule is satisfied
        if (hasSchedules && allHaveSchedules && !isTimingViolation) {
          continue;
        }
      }
    }

    // Determine Interaction Type
    let interactionType: InteractionType = 'medication-medication';
    if (temporalLogic && temporalLogic.type === 'separation') {
      interactionType = 'medication-timing';
    } else if (matchingFoodComponents.length > 0) {
      interactionType = 'medication-food';
    }

    // 4. Build Evidence References
    const evidenceReferences: EvidenceReference[] = (rule.rule_evidence || []).map((e) => {
      const sourceName = e.source_records?.source_name || 'dailymed';
      let jurisdiction: 'US-FDA' | 'US-NLM' | 'US' | 'GLOBAL' = 'US-FDA';
      if (sourceName === 'rxnorm') jurisdiction = 'US-NLM';
      else if (sourceName === 'pubchem') jurisdiction = 'GLOBAL';

      return {
        source: sourceName,
        jurisdiction,
        identifier: e.source_records?.external_identifier || e.id,
        citation_text: e.citation_text,
        source_url: e.source_url,
        evidence_grade: e.evidence_grade,
      };
    });

    const affectedMedIds = matchingMeds.map((m) => m.id);
    const affectedMedNames = matchingMeds.map((m) => m.display_name);

    // Compute State Fingerprint
    const relevantDietaryIds = (context.dietary_records || [])
      .filter(d => matchingFoodComponents.some(c => d.component_name.toLowerCase().includes(c) || c.includes(d.component_name.toLowerCase())))
      .map(d => d.id).sort();

    const stateInputs = {
      rule_version: rule.version,
      medications: matchingMeds.map(m => ({ id: m.id, rel: m.food_relation, sched: m.schedules })).sort((a, b) => a.id.localeCompare(b.id)),
      dietary: relevantDietaryIds
    };
    const state_fingerprint = sha256Fingerprint(JSON.stringify(stateInputs));

    const assessment: InteractionAssessment = {
      assessment_id: generateDeterministicAssessmentId(
        context.patient_id,
        rule.id,
        affectedMedIds
      ),
      state_fingerprint,
      generated_at: evaluationDate.toISOString(),
      patient_id: context.patient_id,
      affected_medication_ids: affectedMedIds,
      affected_medication_names: affectedMedNames,
      affected_food_components:
        matchingFoodComponents.length > 0 ? matchingFoodComponents : undefined,
      interaction_type: interactionType,
      severity: rule.severity,
      mechanism: rule.mechanism,
      effect: rule.effect,
      recommendation_template: rule.recommendation_template,
      rule_id: rule.id,
      rule_key: rule.rule_key,
      rule_version: rule.version,
      evidence_references: evidenceReferences,
      requires_professional_review: rule.severity === 'high',
    };

    assessments.push(assessment);
  }

  // 5. Conflict Resolution: Deduplicate and apply Severity Maximization
  return resolveConflicts(assessments);
}

/**
 * Deterministically merges assessments matching the same medication group
 * and picks the highest severity while accumulating evidence provenance.
 */
function resolveConflicts(assessments: InteractionAssessment[]): InteractionAssessment[] {
  const groupMap = new Map<string, InteractionAssessment[]>();

  for (const a of assessments) {
    const medKey = [...a.affected_medication_ids].sort().join(',');
    const foodKey = (a.affected_food_components || []).sort().join(',');
    const compositeKey = `${a.interaction_type}:${medKey}:${foodKey}`;

    if (!groupMap.has(compositeKey)) {
      groupMap.set(compositeKey, []);
    }
    groupMap.get(compositeKey)!.push(a);
  }

  const resolved: InteractionAssessment[] = [];

  for (const group of groupMap.values()) {
    if (group.length === 1) {
      resolved.push(group[0]);
      continue;
    }

    // Sort by severity descending (high > moderate > low), then by version descending
    group.sort((a, b) => {
      const weightDiff = SEVERITY_WEIGHTS[b.severity] - SEVERITY_WEIGHTS[a.severity];
      if (weightDiff !== 0) return weightDiff;
      return b.rule_version - a.rule_version;
    });

    const primary = group[0];

    // Combine distinct evidence references from all matching rules
    const combinedEvidence: EvidenceReference[] = [];
    const seenEvidence = new Set<string>();

    for (const item of group) {
      for (const ev of item.evidence_references) {
        const evKey = `${ev.source}:${ev.identifier}`;
        if (!seenEvidence.has(evKey)) {
          seenEvidence.add(evKey);
          combinedEvidence.push(ev);
        }
      }
    }

    resolved.push({
      ...primary,
      state_fingerprint: primary.state_fingerprint,
      evidence_references: combinedEvidence,
      requires_professional_review:
        primary.severity === 'high' || group.some((g) => g.requires_professional_review),
    });
  }

  return resolved;
}
