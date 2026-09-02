import { createClient } from '@supabase/supabase-js';

async function checkOllama() {
  console.log('--- OLLAMA LOCAL HEALTH CHECK ---');
  
  // 1. Check if service is reachable
  let tagsResponse;
  try {
    tagsResponse = await fetch('http://localhost:11434/api/tags');
  } catch (e) {
    console.error('❌ FAILED: Could not reach Ollama at http://localhost:11434.');
    console.error('Please ensure Ollama is installed and running.');
    console.error('Download at: https://ollama.com/download');
    process.exit(1);
  }

  if (!tagsResponse.ok) {
    console.error(`❌ FAILED: Ollama API returned HTTP ${tagsResponse.status}`);
    process.exit(1);
  }

  const tagsData = await tagsResponse.json();
  const models = tagsData.models || [];
  
  // 2. Check if the required model is installed
  const requiredModel = process.env.OLLAMA_MODEL || 'qwen2.5vl:3b';
  const hasModel = models.some((m: any) => m.name === requiredModel || m.name === `${requiredModel}:latest` || m.name.startsWith(requiredModel));

  if (!hasModel) {
    console.error(`❌ FAILED: Model '${requiredModel}' is not installed.`);
    console.error(`Please run: ollama pull ${requiredModel}`);
    console.error('This is a large vision model and may take some time to download depending on your internet connection.');
    process.exit(1);
  }

  console.log(`✅ SUCCESS: Ollama is running and '${requiredModel}' is installed!`);
  console.log('You are ready to use MediMind fully offline.');
}

checkOllama().catch(console.error);
