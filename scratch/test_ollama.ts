import { AI_TOOLS } from '../src/services/ai/tools';

async function testOllama() {
  const tools = Object.values(AI_TOOLS).map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema
    }
  }));

  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What medications am I currently taking?' }
  ];

  const res = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5vl:3b',
      messages,
      tools,
      stream: false
    })
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`Ollama HTTP Error: ${res.status}`, text);
  } else {
    console.log('Success!', await res.json());
  }
}

testOllama();
