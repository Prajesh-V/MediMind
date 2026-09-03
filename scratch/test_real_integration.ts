import { generateChatResponse, ChatMessage } from '../src/services/ai/chat';

async function testRealIntegration() {
  const patientId = "00000000-0000-0000-0000-000000000000"; // Dummy ID, will return empty data

  console.log("=== INTEGRATION TEST 1: Current Medications ===");
  const messages1: ChatMessage[] = [
    { role: 'user', content: 'What medications am I currently taking?' }
  ];

  try {
    const res1 = await generateChatResponse(messages1, patientId);
    console.log("Response:", res1);
  } catch (e: any) {
    console.error("Test 1 Failed:", e.message);
  }

  console.log("\n=== INTEGRATION TEST 2: Interactions with Food ===");
  const messages2: ChatMessage[] = [
    { role: 'user', content: 'Are any of my medications interacting with food?' }
  ];

  try {
    const res2 = await generateChatResponse(messages2, patientId);
    console.log("Response:", res2);
  } catch (e: any) {
    console.error("Test 2 Failed:", e.message);
  }
}

testRealIntegration();
