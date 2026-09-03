async function testQwen7b() {
  const model = "qwen2.5vl:7b";
  const url = "http://localhost:11434/api/chat";

  console.log("=== TEST 1: No tools ===");
  const req1 = {
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
    stream: false
  };

  try {
    const res1 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req1)
    });
    console.log(`Test 1 Status: ${res1.status}`);
    if (res1.ok) {
      const data1 = await res1.json();
      console.log(`Test 1 Response: ${data1.message?.content}`);
    } else {
      console.error(`Test 1 Error Body:`, await res1.text());
    }
  } catch (e: any) {
    console.error("Test 1 Fetch Error:", e.message);
  }

  console.log("\n=== TEST 2: One minimal tool ===");
  const tools = [
    {
      type: "function",
      function: {
        name: "test_tool",
        description: "A test tool.",
        parameters: {
          type: "object",
          properties: {},
          required: []
        }
      }
    }
  ];

  const req2 = {
    model,
    messages: [{ role: "user", content: "Please use the test_tool to retrieve my information." }],
    stream: false,
    tools
  };

  let test2Success = false;
  let assistantMessage = null;

  try {
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req2)
    });
    console.log(`Test 2 Status: ${res2.status}`);
    if (res2.ok) {
      const data2 = await res2.json();
      assistantMessage = data2.message;
      console.log(`Test 2 Response Message:`, JSON.stringify(assistantMessage, null, 2));
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        test2Success = true;
      }
    } else {
      console.error(`Test 2 Error Body:`, await res2.text());
    }
  } catch (e: any) {
    console.error("Test 2 Fetch Error:", e.message);
  }

  if (test2Success && assistantMessage) {
    console.log("\n=== TEST 3: Multi-turn tool loop ===");
    
    // Simulate tool result
    const toolResult = {
      success: true,
      data: { answer: "Test information retrieved." }
    };

    const messages3 = [
      ...req2.messages,
      assistantMessage,
      {
        role: "tool",
        name: assistantMessage.tool_calls[0].function.name,
        content: JSON.stringify(toolResult)
      }
    ];

    const req3 = {
      model,
      messages: messages3,
      stream: false,
      tools
    };

    try {
      const res3 = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req3)
      });
      console.log(`Test 3 Status: ${res3.status}`);
      if (res3.ok) {
        const data3 = await res3.json();
        console.log(`Test 3 Final Response:`, data3.message?.content);
      } else {
        console.error(`Test 3 Error Body:`, await res3.text());
      }
    } catch (e: any) {
      console.error("Test 3 Fetch Error:", e.message);
    }
  } else {
    console.log("\n=== TEST 3 SKIPPED (Test 2 failed or did not return tool_calls) ===");
  }
}

testQwen7b();
