#!/usr/bin/env node
/**
 * Quick LLM connectivity test. Run: node scripts/test-llm.mjs
 * Uses OPENROUTER_API_KEY from backend/.env (run from backend/)
 * Tries multiple free models until one works.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;

if (!apiKey) {
  console.error('❌ OPENROUTER_API_KEY not set in .env');
  process.exit(1);
}

// openrouter/free = Free Models Router (auto-selects a free model)
const FREE_MODELS = [
  'openrouter/free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-2-9b-it:free',
  'deepseek/deepseek-r1:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'microsoft/phi-3-mini-128k-instruct:free',
];

async function tryModel(model) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
    }),
  });

  const body = await res.text();
  if (!res.ok) return { ok: false, status: res.status, body: body.slice(0, 150) };

  try {
    const data = JSON.parse(body);
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return { ok: true, text };
  } catch {
    return { ok: false, status: res.status, body };
  }
}

console.log('Trying free models until one works...\n');

for (const model of FREE_MODELS) {
  process.stdout.write(`  ${model} ... `);
  try {
    const result = await tryModel(model);
    if (result.ok) {
      console.log(`✅ ${result.text}`);
      console.log(`\n✅ Working model: ${model}`);
      console.log('\nAdd to .env: AI_MODEL=' + model);
      process.exit(0);
    } else {
      console.log(`❌ ${result.status} ${result.body}`);
    }
  } catch (err) {
    console.log(`❌ ${err.message}`);
  }
}

console.log('\n❌ No free model responded. Try again later or add credits.');
process.exit(1);
