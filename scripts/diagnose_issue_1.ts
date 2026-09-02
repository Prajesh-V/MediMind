import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...rest] = trimmed.split('=');
      const val = rest.join('=').trim().replace(/^["']|["']$/g, '');
      process.env[key.trim()] = val;
    }
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;

async function main() {
  console.log('Testing RPC get_approved_interaction_rules()...');
  const client = createClient(url, publishableKey);
  const { data, error } = await client.rpc('get_approved_interaction_rules');
  console.log('RPC Response:', { count: Array.isArray(data) ? data.length : typeof data, error });
}

main().catch(console.error);
