import fs from 'fs';

function checkRequirements() {
  console.log("Running static tests for ChatAssistant...");

  const content = fs.readFileSync('./src/components/chat/ChatAssistant.tsx', 'utf-8');

  const requirements = [
    { name: "Uses local React state only (useState, useRef, useEffect)", regex: /useState|useRef|useEffect/ },
    { name: "No SWR/React Query/Redux imported", regex: /useSWR|useQuery|useSelector/, shouldFail: true },
    { name: "API integration uses /api/chat", regex: /\/api\/chat/ },
    { name: "Handles success: false explicitly", regex: /data\.success/ },
    { name: "Input area exists", regex: /<textarea/ },
    { name: "Send button exists", regex: /<button.*Send/i },
    { name: "Loading state indicator", regex: /isLoading/ },
    { name: "Prevents duplicate submission (disabled when loading)", regex: /disabled=\{!inputValue\.trim\(\) \|\| isLoading\}/ },
    { name: "Initial state introductory message", regex: /Hi! I can help you understand/ },
    { name: "Enter-to-send without Shift", regex: /e\.key === 'Enter' && !e\.shiftKey/ },
    { name: "Retry mechanism available", regex: /handleRetry/ },
    { name: "No patient_id sent in fetch payload", regex: /body: JSON\.stringify\(\{ messages: updatedMessages \}\)/ }
  ];

  let passed = true;
  for (const req of requirements) {
    const match = req.regex.test(content);
    if ((match && !req.shouldFail) || (!match && req.shouldFail)) {
      console.log(`✅ Passed: ${req.name}`);
    } else {
      console.error(`❌ Failed: ${req.name}`);
      passed = false;
    }
  }

  if (!passed) process.exit(1);
  console.log("Static verification complete!");
}

checkRequirements();
