import { ExplanationOutput } from '../src/services/medical/types';

// Mock validateSemanticContradiction logic to test it in isolation
function validateSemanticContradiction(severity: string, explanation: any) {
  const text = JSON.stringify(explanation).toLowerCase();
  const sev = severity.toLowerCase();
  
  // Contradiction checks
  if (sev === 'high' || sev === 'severe') {
    if (text.includes('minor concern') || text.includes('no concern') || text.includes('perfectly safe') || text.includes('negligible') || text.includes('harmless')) {
      throw new Error(`M7 Semantic Validation Failed: Explanation downplays a HIGH severity interaction as minor/safe.`);
    }
  }
  
  if (sev === 'low' || sev === 'minor') {
    if (text.includes('fatal') || text.includes('life-threatening') || text.includes('critical emergency') || text.includes('severe concern')) {
      throw new Error(`M7 Semantic Validation Failed: Explanation exaggerates a LOW severity interaction.`);
    }
  }

  // Warning for missing explicit severity (non-blocking)
  if (!explanation.what_the_system_determined.toLowerCase().includes(sev)) {
    console.warn('M7 Semantic Validation Warning: LLM explanation did not clearly state the exact severity.');
  }
}

async function runTests() {
  console.log("Running M7 Semantic Validation Tests...\n");

  let passed = 0;
  let failed = 0;

  // TEST 1: MODERATE without the word MODERATE -> ACCEPTED (with warning)
  console.log("TEST 1: M6 MODERATE + explanation without word 'MODERATE'");
  const exp1 = {
    summary: "This interaction is something to watch.",
    what_the_system_determined: "The system flagged this for caution.",
    why_this_matters: "Risk of dizziness.",
    what_was_detected: "Interaction between A and B.",
    next_steps: [],
    limitations: "None",
    source_references: []
  };
  try {
    validateSemanticContradiction("MODERATE", exp1);
    console.log("-> ✅ ACCEPTED (Expected)\n");
    passed++;
  } catch (e) {
    console.error("-> ❌ FAILED (Threw error unexpectedly)", e);
    failed++;
  }

  // TEST 2: HIGH + saying "minor concern" -> REJECTED
  console.log("TEST 2: M6 HIGH + explanation explicitly saying 'minor concern'");
  const exp2 = {
    summary: "This is a minor concern.",
    what_the_system_determined: "The system flagged this as high but it is a minor concern.",
    why_this_matters: "Not a big deal.",
    what_was_detected: "Interaction between A and B.",
    next_steps: [],
    limitations: "None",
    source_references: []
  };
  try {
    validateSemanticContradiction("HIGH", exp2);
    console.error("-> ❌ FAILED (Did not throw expected error)\n");
    failed++;
  } catch (e: any) {
    if (e.message.includes('downplays a HIGH severity')) {
      console.log("-> ✅ REJECTED (Expected):", e.message, "\n");
      passed++;
    } else {
      console.error("-> ❌ FAILED (Wrong error)", e);
      failed++;
    }
  }

  // TEST 3: LOW + saying "life-threatening" -> REJECTED
  console.log("TEST 3: M6 LOW + explanation saying 'life-threatening'");
  const exp3 = {
    summary: "This is life-threatening.",
    what_the_system_determined: "The system flagged this as low.",
    why_this_matters: "Fatal.",
    what_was_detected: "Interaction.",
    next_steps: [],
    limitations: "None",
    source_references: []
  };
  try {
    validateSemanticContradiction("LOW", exp3);
    console.error("-> ❌ FAILED (Did not throw expected error)\n");
    failed++;
  } catch (e: any) {
    if (e.message.includes('exaggerates a LOW severity')) {
      console.log("-> ✅ REJECTED (Expected):", e.message, "\n");
      passed++;
    } else {
      console.error("-> ❌ FAILED (Wrong error)", e);
      failed++;
    }
  }

  console.log(`Results: ${passed} passed, ${failed} failed.`);
}

runTests();
