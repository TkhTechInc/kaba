#!/usr/bin/env node
/**
 * Test mobile money SMS parsing. Run: node scripts/test-mobile-money-parse.mjs
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.AI_MODEL || 'openrouter/free';

if (!apiKey) {
  console.error('❌ OPENROUTER_API_KEY not set');
  process.exit(1);
}

const smsText = `Vous avez recu un transfert de
20000FCFA de MFS PAWAPAY
DISBURSEMENT SP
(2290166336744) le
2026-02-18 23:04:33.
Reference: Txn to deborah.
Nouveau solde: 30312 FCFA.
ID de la transaction :
11547968751.`;

async function parse() {
  const systemPrompt = `You are a parser for West African mobile money SMS (MTN MoMo, Moov, Orange Money, etc.). 
Return valid JSON with: amount (number), currency (3-letter code), date (YYYY-MM-DD), type ("credit" or "debit"), reference (optional), description (optional).
For date: if only time, use today's date. If "04/03/2025" or "03-Mar-2025", convert to YYYY-MM-DD.
Default currency to XOF for FCFA.`;

  const prompt = `Parse this mobile money SMS into structured data. Extract amount, currency (NGN, XOF, XAF, GHS, USD, EUR), date (YYYY-MM-DD), type (credit=received, debit=sent), and optional reference/description.

SMS:
${smsText.trim()}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt + '\nRespond ONLY with valid JSON matching: {"amount":number,"currency":"XOF|NGN|...","date":"YYYY-MM-DD","type":"credit|debit","reference":"optional"}. No markdown, no explanation.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1024,
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const choice = data.choices?.[0];
  const msg = choice?.message || {};
  // Some models (thinking/reasoning) put output in reasoning; content may be null
  let raw = msg.content?.trim() || msg.reasoning?.trim() || '';
  if (!raw) {
    console.error('Debug - full response:', JSON.stringify(data, null, 2).slice(0, 1200));
    return { _raw: 'empty response', finish_reason: choice?.finish_reason };
  }
  // Extract JSON from reasoning if model put it there
  if (msg.reasoning && !msg.content) {
    const jsonMatch = raw.match(/\{[^{}]*"amount"[^{}]*\}/) || raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) raw = jsonMatch[0];
  }
  // Strip markdown code blocks if present
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw.slice(0, 500) };
  }
}

console.log('Parsing SMS...\n');
console.log('Input:', smsText.slice(0, 80) + '...\n');

try {
  const result = await parse();
  console.log('✅ Parsed result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\nExpected: amount=20000, currency=XOF, type=credit, date=2026-02-18');
} catch (err) {
  console.error('❌ Parse failed:', err.message);
  process.exit(1);
}
