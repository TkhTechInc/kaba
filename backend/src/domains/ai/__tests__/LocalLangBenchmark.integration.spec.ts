/**
 * Local Language Model Benchmark
 * Tests Fon and Yoruba understanding across all viable OpenRouter models.
 * Run: npx jest LocalLangBenchmark.integration --no-coverage --verbose --runInBand
 *
 * Purpose: find the best model for West African language intent parsing
 * to replace/supplement Mistral Small (which fails on pure Yoruba diacritics).
 */

import { OpenRouterProvider } from '../providers/OpenRouterProvider';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';
const SKIP = !API_KEY;
const describeIf = SKIP ? describe.skip : describe;

// ─── Shared test inputs ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a financial assistant for West African small businesses.
The user may speak Fon (Bénin/Togo), Yoruba (Nigeria/Bénin), French, English or Pidgin.
Extract the user's intent and financial entities.
Supported intents: record_sale, record_expense, check_balance, unknown.
For record_sale/record_expense: extract amount (number), currency (XOF for Fon/CFA, NGN for Yoruba/Naira), description (string).
If unsure, use "unknown". Always return detectedLanguage.`;

const SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string' },
    entities: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        description: { type: 'string' },
      },
    },
    confidence: { type: 'number' },
    detectedLanguage: { type: 'string' },
  },
  required: ['type', 'entities', 'confidence'],
};

// All test cases with expected results
const TEST_CASES = [
  // Fon — sale (with hint, proven to work)
  {
    id: 'fon-sale-hint',
    lang: 'Fon',
    input: 'Un gbɛ [sold] aso [cloth] 15000 CFA ɖo azan [today]',
    expectedType: 'record_sale',
    expectedAmount: 15000,
    note: 'Fon with bracketed translation hints',
  },
  // Fon — expense (no hint, proven to work)
  {
    id: 'fon-expense',
    lang: 'Fon',
    input: 'Un zán akwɛ 2500 ɖo transport',
    expectedType: 'record_expense',
    expectedAmount: 2500,
    note: 'Pure Fon expense — zán=spent',
  },
  // Fon — pure sale (no hint, known gap)
  {
    id: 'fon-sale-pure',
    lang: 'Fon',
    input: 'Un gbɛ akwɛ 10000 ɖo azã',
    expectedType: 'record_sale',
    expectedAmount: 10000,
    note: 'Pure Fon sale — gbɛ=sold (ambiguous to most models)',
  },
  // Yoruba — sale with diacritics (Mistral fails)
  {
    id: 'yoruba-sale-diacritics',
    lang: 'Yoruba',
    input: 'Mo ta ẹ̀wù fún ìgba náírà',
    expectedType: 'record_sale',
    expectedAmount: 200,
    note: 'Pure Yoruba diacritics — ta=sold, ẹ̀wù=cloth, ìgba náírà=200 naira',
  },
  // Yoruba — expense (Mistral fails)
  {
    id: 'yoruba-expense-diacritics',
    lang: 'Yoruba',
    input: 'Mo nà ẹgbẹ̀rún méjì fún ìrìnnà',
    expectedType: 'record_expense',
    expectedAmount: 2000,
    note: 'Pure Yoruba — nà=spent, ẹgbẹ̀rún méjì=2000, ìrìnnà=transport',
  },
  // Yoruba-English code-switch (all models pass)
  {
    id: 'yoruba-codeswtich',
    lang: 'Yoruba+English',
    input: 'Mo sell rice fún 8000 naira today for market',
    expectedType: 'record_sale',
    expectedAmount: 8000,
    note: 'Code-switched Yoruba-English — baseline all models should pass',
  },
  // Balance — universal
  {
    id: 'balance-yoruba',
    lang: 'Yoruba',
    input: 'Iye owó tó wà nínú àpótí mi jẹ́ ẹ̀tọ́?',
    expectedType: 'check_balance',
    expectedAmount: null,
    note: 'Yoruba balance query — proven to work in most models',
  },
];

// ─── Benchmark runner ─────────────────────────────────────────────────────────

interface BenchmarkResult {
  model: string;
  caseId: string;
  lang: string;
  input: string;
  expected: string;
  got: string;
  amount: number | null;
  expectedAmount: number | null;
  confidence: number;
  detectedLanguage: string;
  pass: boolean;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  note: string;
}

const allResults: BenchmarkResult[] = [];

async function runBenchmark(modelId: string, timeoutMs = 45000): Promise<void> {
  const provider = new OpenRouterProvider(API_KEY, modelId);

  for (const tc of TEST_CASES) {
    const start = Date.now();
    let result: { type: string; entities: Record<string, unknown>; confidence: number; detectedLanguage?: string };
    let tokensIn = 0;
    let tokensOut = 0;

    try {
      const res = await provider.generateStructured<typeof result>({
        prompt: tc.input,
        systemPrompt: SYSTEM_PROMPT,
        jsonSchema: SCHEMA,
        maxTokens: 200,
        temperature: 0,
      });
      result = res.data;
      tokensIn = res.usage?.inputTokens ?? 0;
      tokensOut = res.usage?.outputTokens ?? 0;
    } catch (e) {
      result = { type: 'ERROR', entities: {}, confidence: 0, detectedLanguage: 'unknown' };
    }

    const latencyMs = Date.now() - start;
    const gotAmount = typeof result.entities?.amount === 'number' ? result.entities.amount as number : null;
    const pass = result.type === tc.expectedType &&
      (tc.expectedAmount === null || gotAmount === tc.expectedAmount);

    allResults.push({
      model: modelId,
      caseId: tc.id,
      lang: tc.lang,
      input: tc.input.slice(0, 50),
      expected: tc.expectedType,
      got: result.type,
      amount: gotAmount,
      expectedAmount: tc.expectedAmount,
      confidence: result.confidence,
      detectedLanguage: result.detectedLanguage ?? '?',
      pass,
      latencyMs,
      tokensIn,
      tokensOut,
      note: tc.note,
    });
  }
}

// ─── Model suites ─────────────────────────────────────────────────────────────

const MODELS_TO_TEST: Array<{ id: string; label: string; priceIn: number; priceOut: number }> = [
  // Current intent model — baseline
  { id: 'mistralai/mistral-small-3.2-24b-instruct', label: 'Mistral Small 3.2 (current)', priceIn: 0.06, priceOut: 0.18 },
  // Current voice model — known to handle Yoruba well
  { id: 'qwen/qwen3.5-flash-02-23',                 label: 'Qwen3.5-Flash (current voice)', priceIn: 0.10, priceOut: 0.40 },
  // Llama 4 Maverick — 1M context, multilingual
  { id: 'meta-llama/llama-4-maverick',              label: 'Llama 4 Maverick', priceIn: 0.15, priceOut: 0.60 },
  // Llama 4 Scout — cheaper Llama 4
  { id: 'meta-llama/llama-4-scout',                 label: 'Llama 4 Scout', priceIn: 0.08, priceOut: 0.30 },
  // Gemma 3 27B — Google, known multilingual
  { id: 'google/gemma-3-27b-it',                    label: 'Gemma 3 27B', priceIn: 0.04, priceOut: 0.15 },
  // Llama 3.3 70B — current ledger QA model, also free tier
  { id: 'meta-llama/llama-3.3-70b-instruct',        label: 'Llama 3.3 70B', priceIn: 0.10, priceOut: 0.32 },
  // Qwen3 30B — newer Qwen, cheaper than 3.5-flash per token
  { id: 'qwen/qwen3-30b-a3b',                       label: 'Qwen3 30B A3B', priceIn: 0.08, priceOut: 0.28 },
];

describeIf('[BENCHMARK] West African Language Model Comparison', () => {
  afterAll(() => {
    // Print full scoreboard after all tests
    console.log('\n');
    console.log('═'.repeat(100));
    console.log('  WEST AFRICAN LANGUAGE BENCHMARK — FINAL SCOREBOARD');
    console.log('═'.repeat(100));

    // Score per model
    const byModel: Record<string, BenchmarkResult[]> = {};
    for (const r of allResults) {
      if (!byModel[r.model]) byModel[r.model] = [];
      byModel[r.model].push(r);
    }

    const scores: Array<{ model: string; score: number; total: number; avgLatency: number; label: string }> = [];

    for (const [modelId, results] of Object.entries(byModel)) {
      const passed = results.filter(r => r.pass).length;
      const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / results.length);
      const m = MODELS_TO_TEST.find(m => m.id === modelId);
      scores.push({ model: modelId, score: passed, total: results.length, avgLatency, label: m?.label ?? modelId });
    }

    scores.sort((a, b) => b.score - a.score || a.avgLatency - b.avgLatency);

    console.log('\n  RANKING (by pass rate, then speed):');
    console.log('  ' + '-'.repeat(95));
    console.log(`  ${'Model'.padEnd(35)} ${'Score'.padEnd(10)} ${'Avg Latency'.padEnd(15)} ${'$/1M in'.padEnd(10)}`);
    console.log('  ' + '-'.repeat(95));

    for (const s of scores) {
      const m = MODELS_TO_TEST.find(m => m.id === s.model);
      const pct = Math.round((s.score / s.total) * 100);
      const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      console.log(`  ${s.label.padEnd(35)} ${`${s.score}/${s.total} ${bar}`.padEnd(25)} ${`${s.avgLatency}ms`.padEnd(15)} $${m?.priceIn ?? '?'}`);
    }

    // Per-case breakdown
    console.log('\n  PER-CASE BREAKDOWN:');
    console.log('  ' + '-'.repeat(95));

    for (const tc of TEST_CASES) {
      console.log(`\n  [${tc.lang}] ${tc.note}`);
      console.log(`  Input: "${tc.input.slice(0, 60)}"`);
      for (const s of scores) {
        const r = allResults.find(r => r.model === s.model && r.caseId === tc.id);
        if (!r) continue;
        const icon = r.pass ? '✓' : '✗';
        const amt = r.amount !== null ? ` amount=${r.amount}` : '';
        console.log(`    ${icon} ${s.label.padEnd(33)} → ${r.got}${amt} (conf=${r.confidence}, lang=${r.detectedLanguage}, ${r.latencyMs}ms)`);
      }
    }

    console.log('\n  RECOMMENDATION:');
    const best = scores[0];
    console.log(`  Best overall: ${best.label} — ${best.score}/${best.total} cases, avg ${best.avgLatency}ms`);
    console.log('═'.repeat(100));
  });

  for (const model of MODELS_TO_TEST) {
    it(`[${model.label}] — runs all ${TEST_CASES.length} test cases`, async () => {
      await runBenchmark(model.id, 60000);

      const myResults = allResults.filter(r => r.model === model.id);
      const passed = myResults.filter(r => r.pass).length;
      console.log(`\n  ${model.label}: ${passed}/${TEST_CASES.length} passed`);
      for (const r of myResults) {
        const icon = r.pass ? '✓' : '✗';
        console.log(`    ${icon} [${r.lang}] ${r.note.slice(0, 50).padEnd(50)} → ${r.got} (${r.confidence}) ${r.latencyMs}ms`);
      }

      // Soft pass — we want to see results even if some cases fail
      expect(myResults.length).toBe(TEST_CASES.length);
    }, 120000);
  }
});
