async function testOllama() {
  const model = "qwen2.5vl:3b";
  const url = "http://localhost:11434/api/chat";

  console.log("=== TEST A: No tools ===");
  const reqA = {
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
    stream: false
  };

  try {
    const resA = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqA)
    });
    console.log(`Test A Status: ${resA.status}`);
    if (resA.ok) {
      const dataA = await resA.json();
      console.log(`Test A Response: ${dataA.message?.content}`);
    } else {
      console.error(`Test A Error Body:`, await resA.text());
    }
  } catch (e: any) {
    console.error("Test A Fetch Error:", e.message);
  }

  console.log("\n=== TEST B: One minimal tool ===");
  const reqB = {
    model,
    messages: [{ role: "user", content: "Say hello in one sentence." }],
    stream: false,
    tools: [
      {
        type: "function",
        function: {
          name: "test_tool",
          description: "A test tool.",
          parameters: {
            type: "object",
            properties: {}
          }
        }
      }
    ]
  };

  try {
    const resB = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqB)
    });
    console.log(`Test B Status: ${resB.status}`);
    if (resB.ok) {
      const dataB = await resB.json();
      console.log(`Test B Response:`, JSON.stringify(dataB.message));
    } else {
      console.error(`Test B Error Body:`, await resB.text());
    }
  } catch (e: any) {
    console.error("Test B Fetch Error:", e.message);
  }
}

testOllama();
