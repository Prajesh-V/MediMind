import { getPatientActiveMedications } from '@/app/actions/medication';
import { getPatientDoseHistory } from '@/app/actions/dose';
import { getPatientDietaryRecords } from '@/app/actions/intake';
import { getPatientAssessments } from '@/app/actions/interactions';

export interface ToolDefinition {
  name: string;
  description: string;
  schema: any; // JSON Schema for LLM
  execute: (args: any, patientId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
}

/**
 * Executes a tool safely, enforcing the standard { success, data, error } envelope
 * so the LLM receives structured failures instead of guessing.
 */
async function safeExecute<T>(fn: () => Promise<T>): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error: any) {
    console.error('[AI_TOOL_ERROR]', error);
    return { 
      success: false, 
      error: error.message || 'CLINICAL_DATA_UNAVAILABLE' 
    };
  }
}

export const AI_TOOLS: Record<string, ToolDefinition> = {
  get_current_medications: {
    name: 'get_current_medications',
    description: 'Retrieves the patient\'s currently active, verified medications. Use this to find out what medications the patient is currently taking.',
    schema: {
      type: 'object',
      properties: {}
    },
    execute: async (_args: any, patientId: string) => {
      // The LLM arguments are ignored. The patientId is strictly injected by the server session.
      return safeExecute(() => getPatientActiveMedications(patientId));
    }
  },

  get_recent_doses: {
    name: 'get_recent_doses',
    description: 'Retrieves the patient\'s recent medication administration (dose) history.',
    schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent records to retrieve (default 10)' }
      }
    },
    execute: async (args: any, patientId: string) => {
      return safeExecute(async () => {
        const allDoses = await getPatientDoseHistory(patientId, args?.days || 30);
        const limit = typeof args?.limit === 'number' && args.limit > 0 ? args.limit : 10;
        return allDoses.slice(0, limit);
      });
    }
  },

  get_food_history: {
    name: 'get_food_history',
    description: 'Retrieves the patient\'s recent dietary intake and food history.',
    schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back (default 7)' }
      }
    },
    execute: async (_args: any, patientId: string) => {
      return safeExecute(async () => {
        // Current getPatientDietaryRecords returns all recent intake. 
        // We let the LLM filter by date if needed, or we just return the dataset.
        return await getPatientDietaryRecords(patientId);
      });
    }
  },

  get_relevant_doses: {
    name: 'get_relevant_doses',
    description: 'Retrieves recent doses specifically for a given medication name.',
    schema: {
      type: 'object',
      properties: {
        medication_name: { type: 'string', description: 'The name of the medication to filter by' }
      },
      required: ['medication_name']
    },
    execute: async (args: any, patientId: string) => {
      if (!args?.medication_name) {
        return { success: false, error: 'medication_name argument is required' };
      }
      return safeExecute(async () => {
        const allDoses = await getPatientDoseHistory(patientId, args?.days || 30);
        const term = args.medication_name.toLowerCase();
        return allDoses.filter((d: any) => {
          const med = d.patient_medications;
          return (med?.display_name && med.display_name.toLowerCase().includes(term)) ||
                 (med?.generic_name && med.generic_name.toLowerCase().includes(term));
        });
      });
    }
  },

  check_interactions: {
    name: 'check_interactions',
    description: 'Runs the authoritative M6 deterministic interaction engine to assess current medications and diet for clinical warnings. Returns assessments which include severity, interaction type, and embedded authoritative clinical evidence citations.',
    schema: {
      type: 'object',
      properties: {}
    },
    execute: async (_args: any, patientId: string) => {
      // Re-uses the deterministic M6 Server Action. Evidence is natively embedded in the result.
      return safeExecute(() => getPatientAssessments(patientId));
    }
  }
};
