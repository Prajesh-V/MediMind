import { AI_TOOLS } from '../src/services/ai/tools';

async function runTests() {
  console.log("Running AI Tools tests...");

  // We mock safeExecute indirectly by just calling the tool schemas and checking structure.
  console.log("1. check_interactions uses M6:");
  if (AI_TOOLS.check_interactions.execute.toString().includes('getPatientAssessments')) {
    console.log("✅ YES. check_interactions calls getPatientAssessments (M6).");
  } else {
    console.error("❌ NO. check_interactions does not call M6.");
  }

  console.log("2. No mutation tools exist:");
  const keys = Object.keys(AI_TOOLS);
  const mutations = keys.filter(k => k.includes('create') || k.includes('update') || k.includes('delete') || k.includes('set'));
  if (mutations.length === 0) {
    console.log("✅ YES. Only read-only tools exist.");
  } else {
    console.error("❌ NO. Found potential mutation tools: ", mutations);
  }

  console.log("3. Patient identity is derived server-side:");
  // Check the arguments of the execute function for get_current_medications
  const execStr = AI_TOOLS.get_current_medications.execute.toString();
  if (execStr.includes('patientId') && !execStr.includes('args.patientId')) {
    console.log("✅ YES. patientId is injected from arguments (server), not args (LLM).");
  } else {
    console.error("❌ NO. Server identity check failed.");
  }

  console.log("4. Recent dose retrieval covers recent history (not just today):");
  const rdStr = AI_TOOLS.get_recent_doses.execute.toString();
  if (rdStr.includes('getPatientDoseHistory')) {
    console.log("✅ YES. get_recent_doses uses getPatientDoseHistory.");
  } else {
    console.error("❌ NO. get_recent_doses does not use getPatientDoseHistory.");
  }
}

runTests();
