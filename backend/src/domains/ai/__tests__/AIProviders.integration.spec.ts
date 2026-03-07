/**
 * Integration tests — hit real OpenRouter models, no mocks.
 *
 * Skipped automatically when OPENROUTER_API_KEY is not set (CI without secrets).
 * Run locally with: npx jest AIProviders.integration --no-coverage --verbose
 *
 * These tests validate:
 *  - Each per-task model actually responds
 *  - The response shape matches what our services expect
 *  - The model understands West African financial context (XOF, French)
 */

import { OpenRouterProvider } from '../providers/OpenRouterProvider';

// Load .env for local runs
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const API_KEY = process.env['OPENROUTER_API_KEY'] ?? '';
const SKIP = !API_KEY;

// Helper to log token usage
function logUsage(label: string, usage?: { inputTokens: number; outputTokens: number }) {
  if (usage) {
    console.log(`  [${label}] tokens — in: ${usage.inputTokens}, out: ${usage.outputTokens}`);
  }
}

// Conditionally skip entire suite if no API key
const describeIf = SKIP ? describe.skip : describe;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Intent Parsing — Mistral Small 3.2 24B
// ─────────────────────────────────────────────────────────────────────────────
describeIf('[INTEGRATION] Intent Parser — mistral-small-3.2-24b', () => {
  const model = process.env['AI_INTENT_MODEL'] ?? 'mistralai/mistral-small-3.2-24b-instruct';
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider(API_KEY, model);
  });

  it('classifies French sale message as record_sale', async () => {
    const result = await provider.generateStructured<{
      type: string;
      entities: Record<string, unknown>;
      confidence: number;
      rawText: string;
    }>({
      prompt: "J'ai vendu du riz pour 5000 XOF à Kofi",
      systemPrompt: `You are a financial assistant for West African small businesses.
Extract the user's intent. Supported intents: record_sale, record_expense, check_balance,
list_unpaid_invoices, list_debts, get_trust_score, generate_invoice, send_invoice, get_report, unknown.
For record_sale/record_expense, extract: amount (number), currency (string, default XOF), description (string), customerName (string, optional).`,
      jsonSchema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          entities: { type: 'object' },
          confidence: { type: 'number' },
          rawText: { type: 'string' },
        },
        required: ['type', 'entities', 'confidence'],
      },
      maxTokens: 256,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data.type).toBe('record_sale');
    expect(result.data.confidence).toBeGreaterThan(0.5);
    expect(result.data.entities).toMatchObject(
      expect.objectContaining({ amount: 5000 }),
    );
  }, 30000);

  it('classifies English balance query as check_balance', async () => {
    const result = await provider.generateStructured<{ type: string; confidence: number; entities: object; rawText: string }>({
      prompt: 'What is my current balance?',
      systemPrompt: `You are a financial assistant. Supported intents: record_sale, record_expense, check_balance, list_unpaid_invoices, list_debts, get_trust_score, generate_invoice, send_invoice, get_report, unknown.`,
      jsonSchema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          entities: { type: 'object' },
          confidence: { type: 'number' },
          rawText: { type: 'string' },
        },
        required: ['type', 'entities', 'confidence'],
      },
      maxTokens: 256,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data.type).toBe('check_balance');
    expect(result.data.confidence).toBeGreaterThan(0.5);
  }, 30000);

  it('falls back to unknown for gibberish', async () => {
    const result = await provider.generateStructured<{ type: string; confidence: number; entities: object; rawText: string }>({
      prompt: 'asdfgh qwerty zxcv',
      systemPrompt: `You are a financial assistant. Supported intents: record_sale, record_expense, check_balance, list_unpaid_invoices, list_debts, get_trust_score, generate_invoice, send_invoice, get_report, unknown. If unsure, use "unknown".`,
      jsonSchema: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          entities: { type: 'object' },
          confidence: { type: 'number' },
          rawText: { type: 'string' },
        },
        required: ['type', 'entities', 'confidence'],
      },
      maxTokens: 256,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data.type).toBe('unknown');
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Voice / Transaction Extraction — Qwen3.5-Flash
// ─────────────────────────────────────────────────────────────────────────────
describeIf('[INTEGRATION] Voice Extraction — qwen3.5-flash', () => {
  const model = process.env['AI_VOICE_MODEL'] ?? 'qwen/qwen3.5-flash';
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider(API_KEY, model);
  });

  it('extracts sale transaction from French voice input', async () => {
    const result = await provider.generateStructured<{
      type: string;
      amount: number;
      description: string;
      category: string;
    }>({
      prompt: "J'ai vendu du tissu wax pour 25000 francs à une cliente",
      systemPrompt: 'Extract sale or expense. Return JSON: { type: "sale"|"expense", amount: number, description: string, category: string }.',
      jsonSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['sale', 'expense'] },
          amount: { type: 'number' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['type', 'amount', 'description', 'category'],
      },
      maxTokens: 256,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data.type).toBe('sale');
    expect(result.data.amount).toBe(25000);
    expect(result.data.description).toBeTruthy();
    expect(result.data.category).toBeTruthy();
  }, 30000);

  it('extracts expense from Pidgin/mixed language input', async () => {
    const result = await provider.generateStructured<{
      type: string;
      amount: number;
      description: string;
      category: string;
    }>({
      prompt: 'I spend 3500 XOF for transport today go market',
      systemPrompt: 'Extract sale or expense transaction. Return JSON: { type: "sale"|"expense", amount: number, description: string, category: string }.',
      jsonSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['sale', 'expense'] },
          amount: { type: 'number' },
          description: { type: 'string' },
          category: { type: 'string' },
        },
        required: ['type', 'amount', 'description', 'category'],
      },
      maxTokens: 256,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data.type).toBe('expense');
    expect(result.data.amount).toBe(3500);
    expect(result.data.category.toLowerCase()).toMatch(/transport|travel|logistique/i);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Loan Readiness — DeepSeek R1 0528
// ─────────────────────────────────────────────────────────────────────────────
describeIf('[INTEGRATION] Loan Readiness — deepseek-r1-0528', () => {
  const model = process.env['AI_LOAN_MODEL'] ?? 'deepseek/deepseek-r1-0528';
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider(API_KEY, model);
  });

  it('rates a profitable business higher than a loss-making one', async () => {
    const profitable = await provider.generateStructured<{ score: number; suggestions: string[] }>({
      prompt: `Business data: 45 transactions, net profit 850000 XOF, avg daily revenue 12000 XOF, consistency 80%, positive trend true.
Rate loan readiness 1-5 (5=ready). Give 2-3 short suggestions. Return JSON: { score: number, suggestions: string[] }`,
      systemPrompt: 'You are a microfinance loan assessor for West African MSMEs. Be practical.',
      jsonSchema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'suggestions'],
      },
      maxTokens: 512,
      temperature: 0,
    });

    const losing = await provider.generateStructured<{ score: number; suggestions: string[] }>({
      prompt: `Business data: 5 transactions, net profit -200000 XOF, avg daily revenue 1000 XOF, consistency 10%, positive trend false.
Rate loan readiness 1-5 (5=ready). Give 2-3 short suggestions. Return JSON: { score: number, suggestions: string[] }`,
      systemPrompt: 'You are a microfinance loan assessor for West African MSMEs. Be practical.',
      jsonSchema: {
        type: 'object',
        properties: {
          score: { type: 'number' },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['score', 'suggestions'],
      },
      maxTokens: 512,
      temperature: 0,
    });

    console.log('\n  Profitable business score:', profitable.data.score);
    console.log('  Suggestions:', profitable.data.suggestions);
    logUsage(model, profitable.usage);
    console.log('\n  Losing business score:', losing.data.score);
    console.log('  Suggestions:', losing.data.suggestions);
    logUsage(model, losing.usage);

    expect(profitable.data.score).toBeGreaterThanOrEqual(1);
    expect(profitable.data.score).toBeLessThanOrEqual(5);
    expect(losing.data.score).toBeGreaterThanOrEqual(1);
    expect(losing.data.score).toBeLessThanOrEqual(5);
    expect(profitable.data.score).toBeGreaterThan(losing.data.score);
    expect(Array.isArray(profitable.data.suggestions)).toBe(true);
    expect(profitable.data.suggestions.length).toBeGreaterThan(0);
  }, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Ledger Q&A — Llama 3.3 70B
// ─────────────────────────────────────────────────────────────────────────────
describeIf('[INTEGRATION] Ledger Q&A — llama-3.3-70b', () => {
  const model = process.env['AI_LEDGER_QA_MODEL'] ?? 'meta-llama/llama-3.3-70b-instruct';
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider(API_KEY, model);
  });

  it('answers a question about total income from ledger data', async () => {
    const ledgerSummary = {
      totalIncome: 750000,
      totalExpenses: 320000,
      netProfit: 430000,
      transactionCount: 28,
      byCategory: { Sales: 750000, Supplies: 200000, Transport: 120000 },
    };

    const result = await provider.generateText({
      prompt: `User question: "Combien ai-je gagné ce mois-ci?"

Business data (last 28 transactions):
${JSON.stringify(ledgerSummary, null, 2)}

Answer the question concisely based only on the data above.`,
      systemPrompt: 'You are a helpful accounting assistant for a small business in West Africa. Answer based only on the provided data. Be concise.',
      maxTokens: 256,
    });

    console.log('\n  Model response:', result.text);
    logUsage(model, result.usage);

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(10);
    // Should mention the income figure somewhere in the answer
    expect(result.text).toMatch(/750[\s,.]?000|750k/i);
  }, 30000);

  it('provides category breakdown when asked', async () => {
    const ledgerSummary = {
      totalIncome: 500000,
      totalExpenses: 180000,
      netProfit: 320000,
      transactionCount: 15,
      byCategory: { Alimentation: 500000, Carburant: 80000, Loyer: 100000 },
    };

    const result = await provider.generateText({
      prompt: `User question: "Show me my spending by category"

Business data:
${JSON.stringify(ledgerSummary, null, 2)}

Answer concisely.`,
      systemPrompt: 'You are a helpful accounting assistant for a small business in West Africa. Answer based only on the provided data.',
      maxTokens: 256,
    });

    console.log('\n  Model response:', result.text);
    logUsage(model, result.usage);

    expect(result.text).toBeTruthy();
    // Should mention at least one category from the data
    expect(result.text).toMatch(/Alimentation|Carburant|Loyer/i);
  }, 30000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Default model — DeepSeek Chat v3 (fallback)
// ─────────────────────────────────────────────────────────────────────────────
describeIf('[INTEGRATION] Default fallback model — deepseek-chat-v3', () => {
  const model = process.env['AI_MODEL'] ?? 'deepseek/deepseek-chat-v3-0324:free';
  let provider: OpenRouterProvider;

  beforeAll(() => {
    provider = new OpenRouterProvider(API_KEY, model);
  });

  it('generates a coherent text response', async () => {
    const result = await provider.generateText({
      prompt: 'In one sentence, what is the BCEAO?',
      maxTokens: 128,
    });

    console.log('\n  Model response:', result.text);
    logUsage(model, result.usage);

    expect(result.text).toBeTruthy();
    expect(result.text.length).toBeGreaterThan(20);
    expect(result.provider).toBe('openrouter');
    expect(result.model).toBe(model);
  }, 30000);

  it('returns valid JSON for structured output', async () => {
    const result = await provider.generateStructured<{ name: string; currency: string; country: string }>({
      prompt: 'Describe Kaba, a West African accounting app',
      systemPrompt: 'Return a JSON object describing the app.',
      jsonSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          currency: { type: 'string' },
          country: { type: 'string' },
        },
        required: ['name', 'currency', 'country'],
      },
      maxTokens: 128,
      temperature: 0,
    });

    console.log('\n  Model response:', JSON.stringify(result.data, null, 2));
    logUsage(model, result.usage);

    expect(result.data).toBeDefined();
    expect(typeof result.data.name).toBe('string');
    expect(typeof result.data.currency).toBe('string');
    expect(typeof result.data.country).toBe('string');
  }, 30000);
});
