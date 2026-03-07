import { VoiceToTransactionService } from '../VoiceToTransactionService';
import { LoanReadinessService } from '../LoanReadinessService';
import { AIQueryService } from '../AIQueryService';
import type { ILLMProvider, GenerateStructuredResponse, GenerateTextResponse } from '../ILLMProvider';
import type { ISpeechToText } from '../ISpeechToText';
import { ValidationError, AIProviderError } from '@/shared/errors/DomainError';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockLLM(): jest.Mocked<ILLMProvider> {
  return {
    generateText: jest.fn(),
    generateStructured: jest.fn(),
  };
}

function makeMockSpeechToText(): jest.Mocked<ISpeechToText> {
  return {
    transcribe: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// VoiceToTransactionService
// ---------------------------------------------------------------------------

describe('VoiceToTransactionService', () => {
  let llm: jest.Mocked<ILLMProvider>;
  let speechToText: jest.Mocked<ISpeechToText>;
  let ledgerService: { createEntry: jest.Mock };
  let service: VoiceToTransactionService;

  beforeEach(() => {
    llm = makeMockLLM();
    speechToText = makeMockSpeechToText();
    ledgerService = { createEntry: jest.fn() };

    service = new VoiceToTransactionService(
      llm as unknown as ILLMProvider,
      speechToText as unknown as ISpeechToText,
      ledgerService as any,
    );
  });

  it('processFromText — extracts a sale transaction correctly', async () => {
    const extracted = { type: 'sale' as const, amount: 25000, description: 'Vente de tissu wax', category: 'Sales' };
    llm.generateStructured.mockResolvedValueOnce({
      data: extracted,
      provider: 'mock',
      model: 'mock',
    } as GenerateStructuredResponse<typeof extracted>);

    const savedEntry = {
      id: 'entry-001',
      type: 'sale',
      amount: 25000,
      description: 'Vente de tissu wax',
      category: 'Sales',
    };
    ledgerService.createEntry.mockResolvedValueOnce(savedEntry);

    const result = await service.processFromText(
      "J'ai vendu du tissu wax pour 25000 XOF",
      'biz-001',
      'XOF',
    );

    expect(result.success).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry?.type).toBe('sale');
    expect(result.entry?.amount).toBe(25000);
    expect(result.entry?.description).toBe('Vente de tissu wax');
    expect(ledgerService.createEntry).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sale', amount: 25000, currency: 'XOF', businessId: 'biz-001' }),
    );
  });

  it('processFromText — extracts an expense transaction correctly', async () => {
    const extracted = { type: 'expense' as const, amount: 8500, description: 'Achat de matières premières', category: 'Supplies' };
    llm.generateStructured.mockResolvedValueOnce({
      data: extracted,
      provider: 'mock',
      model: 'mock',
    } as GenerateStructuredResponse<typeof extracted>);

    const savedEntry = {
      id: 'entry-002',
      type: 'expense',
      amount: 8500,
      description: 'Achat de matières premières',
      category: 'Supplies',
    };
    ledgerService.createEntry.mockResolvedValueOnce(savedEntry);

    const result = await service.processFromText(
      "J'ai dépensé 8500 XOF pour des matières premières",
      'biz-001',
      'XOF',
    );

    expect(result.success).toBe(true);
    expect(result.entry?.type).toBe('expense');
    expect(result.entry?.amount).toBe(8500);
    expect(result.entry?.category).toBe('Supplies');
  });

  it('processFromText — returns error result when LLM throws', async () => {
    llm.generateStructured.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await service.processFromText("achat de riz 3000", 'biz-001', 'XOF');

    expect(result.success).toBe(false);
    expect(result.error).toContain('AI extraction failed');
    expect(result.error).toContain('LLM unavailable');
    expect(ledgerService.createEntry).not.toHaveBeenCalled();
  });

  it('processFromAudio — transcribes audio then delegates to processFromText', async () => {
    speechToText.transcribe.mockResolvedValueOnce({ text: "J'ai vendu du poulet pour 5000" });

    const extracted = { type: 'sale' as const, amount: 5000, description: 'Vente de poulet', category: 'Sales' };
    llm.generateStructured.mockResolvedValueOnce({
      data: extracted,
      provider: 'mock',
      model: 'mock',
    } as GenerateStructuredResponse<typeof extracted>);

    ledgerService.createEntry.mockResolvedValueOnce({
      id: 'entry-003',
      type: 'sale',
      amount: 5000,
      description: 'Vente de poulet',
      category: 'Sales',
    });

    const audioBuffer = Buffer.from('fake-audio-data');
    const result = await service.processFromAudio(audioBuffer, 'biz-001', 'XOF');

    expect(speechToText.transcribe).toHaveBeenCalledWith(audioBuffer);
    expect(llm.generateStructured).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.entry?.amount).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// LoanReadinessService
// ---------------------------------------------------------------------------

describe('LoanReadinessService', () => {
  let llm: jest.Mocked<ILLMProvider>;
  let ledgerRepo: { listByBusinessAndDateRange: jest.Mock };
  let reportService: { getPL: jest.Mock };
  let service: LoanReadinessService;

  const baseEntries = [
    { id: '1', type: 'sale', amount: 150000, date: '2026-02-01', businessId: 'biz-001', category: 'Sales', currency: 'XOF' },
    { id: '2', type: 'sale', amount: 120000, date: '2026-02-05', businessId: 'biz-001', category: 'Sales', currency: 'XOF' },
    { id: '3', type: 'expense', amount: 50000, date: '2026-02-03', businessId: 'biz-001', category: 'Supplies', currency: 'XOF' },
  ];

  beforeEach(() => {
    llm = makeMockLLM();
    ledgerRepo = { listByBusinessAndDateRange: jest.fn() };
    reportService = { getPL: jest.fn() };

    service = new LoanReadinessService(
      llm as unknown as ILLMProvider,
      ledgerRepo as any,
      reportService as any,
    );
  });

  it('getScore — returns a score between 1 and 5', async () => {
    ledgerRepo.listByBusinessAndDateRange.mockResolvedValueOnce(baseEntries);
    reportService.getPL.mockResolvedValueOnce({ netProfit: 220000, revenue: 270000, expenses: 50000 });
    llm.generateStructured.mockResolvedValueOnce({
      data: { score: 4, suggestions: ['Increase daily sales frequency'] },
      provider: 'mock',
      model: 'mock',
    });

    const result = await service.getScore('biz-001', '2026-02-01', '2026-02-28');

    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(5);
    expect(result.maxScore).toBe(5);
  });

  it('getScore — returns suggestions array from LLM', async () => {
    ledgerRepo.listByBusinessAndDateRange.mockResolvedValueOnce(baseEntries);
    reportService.getPL.mockResolvedValueOnce({ netProfit: 100000, revenue: 150000, expenses: 50000 });
    llm.generateStructured.mockResolvedValueOnce({
      data: {
        score: 3,
        suggestions: [
          'Enregistrez vos ventes quotidiennement',
          'Réduisez vos dépenses variables',
          'Augmentez la fréquence de vos transactions',
        ],
      },
      provider: 'mock',
      model: 'mock',
    });

    const result = await service.getScore('biz-001', '2026-01-01', '2026-01-31');

    expect(Array.isArray(result.suggestions)).toBe(true);
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toContain('ventes');
  });

  it('getScore — business with positive P&L gets higher score than one with negative P&L', async () => {
    // Profitable business
    ledgerRepo.listByBusinessAndDateRange
      .mockResolvedValueOnce(baseEntries)
      .mockResolvedValueOnce([
        { id: '10', type: 'expense', amount: 500000, date: '2026-02-01', businessId: 'biz-002', category: 'Overhead', currency: 'XOF' },
      ]);

    reportService.getPL
      .mockResolvedValueOnce({ netProfit: 220000, revenue: 270000, expenses: 50000 })
      .mockResolvedValueOnce({ netProfit: -200000, revenue: 50000, expenses: 250000 });

    llm.generateStructured
      .mockResolvedValueOnce({
        data: { score: 4, suggestions: ['Maintenez ce rythme de croissance'] },
        provider: 'mock',
        model: 'mock',
      })
      .mockResolvedValueOnce({
        data: { score: 2, suggestions: ['Réduisez vos charges fixes', 'Augmentez vos revenus'] },
        provider: 'mock',
        model: 'mock',
      });

    const profitableResult = await service.getScore('biz-001', '2026-02-01', '2026-02-28');
    const lossResult = await service.getScore('biz-002', '2026-02-01', '2026-02-28');

    expect(profitableResult.score).toBeGreaterThan(lossResult.score);
    expect(profitableResult.summary.hasPositiveTrend).toBe(true);
    expect(lossResult.summary.hasPositiveTrend).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AIQueryService
// ---------------------------------------------------------------------------

describe('AIQueryService', () => {
  let llm: jest.Mocked<ILLMProvider>;
  let ledgerRepo: { listAllByBusinessForBalance: jest.Mock };
  let featureService: { isWithinLimit: jest.Mock; getLimit: jest.Mock };
  let businessRepo: { getOrCreate: jest.Mock };
  let usageRepo: { getAiQueryCount: jest.Mock; incrementAiQueries: jest.Mock };
  let service: AIQueryService;

  const sampleEntries = [
    { id: '1', type: 'sale', amount: 50000, category: 'Sales', date: '2026-02-10', currency: 'XOF', businessId: 'biz-001' },
    { id: '2', type: 'expense', amount: 15000, category: 'Transport', date: '2026-02-12', currency: 'XOF', businessId: 'biz-001' },
    { id: '3', type: 'expense', amount: 10000, category: 'Transport', date: '2026-02-14', currency: 'XOF', businessId: 'biz-001' },
  ];

  beforeEach(() => {
    llm = makeMockLLM();
    ledgerRepo = { listAllByBusinessForBalance: jest.fn() };
    featureService = { isWithinLimit: jest.fn(), getLimit: jest.fn() };
    businessRepo = { getOrCreate: jest.fn() };
    usageRepo = { getAiQueryCount: jest.fn(), incrementAiQueries: jest.fn() };

    service = new AIQueryService(
      llm as unknown as ILLMProvider,
      ledgerRepo as any,
      featureService as any,
      businessRepo as any,
      usageRepo as any,
    );

    // Default: usage within limit
    businessRepo.getOrCreate.mockResolvedValue({ id: 'biz-001', tier: 'pro' });
    usageRepo.getAiQueryCount.mockResolvedValue(5);
    featureService.isWithinLimit.mockReturnValue(true);
    usageRepo.incrementAiQueries.mockResolvedValue(undefined);
    ledgerRepo.listAllByBusinessForBalance.mockResolvedValue(sampleEntries);
  });

  it('ask — calls llm.generateText with ledger summary context', async () => {
    llm.generateText.mockResolvedValueOnce({
      text: 'Vos ventes totales sont de 50 000 XOF',
      provider: 'mock',
      model: 'mock',
    } as GenerateTextResponse);

    const result = await service.ask('biz-001', 'Quelles sont mes ventes totales?');

    expect(llm.generateText).toHaveBeenCalledTimes(1);
    const callArgs = llm.generateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain('Quelles sont mes ventes totales?');
    expect(callArgs.prompt).toContain('totalIncome');
    expect(result.answer).toBe('Vos ventes totales sont de 50 000 XOF');
    expect(result.data).toBeDefined();
    expect(usageRepo.incrementAiQueries).toHaveBeenCalledWith('biz-001');
  });

  it('ask — throws ValidationError when usage limit is exceeded', async () => {
    featureService.isWithinLimit.mockReturnValue(false);
    featureService.getLimit.mockReturnValue(10);
    usageRepo.getAiQueryCount.mockResolvedValue(10);

    await expect(
      service.ask('biz-001', 'Combien ai-je dépensé ce mois?'),
    ).rejects.toThrow(ValidationError);

    expect(llm.generateText).not.toHaveBeenCalled();
    expect(usageRepo.incrementAiQueries).not.toHaveBeenCalled();
  });

  it('ask — returns chartData when query mentions "category"', async () => {
    llm.generateText.mockResolvedValueOnce({
      text: 'Voici la répartition par catégorie',
      provider: 'mock',
      model: 'mock',
    } as GenerateTextResponse);

    const result = await service.ask('biz-001', 'Montre-moi la répartition par category');

    expect(result.chartData).toBeDefined();
    expect(Array.isArray(result.chartData)).toBe(true);
    expect(result.chartData!.length).toBeGreaterThan(0);
    expect(result.chartData![0]).toHaveProperty('label');
    expect(result.chartData![0]).toHaveProperty('value');

    // Transport expenses should appear in chart
    const transportEntry = result.chartData!.find((d) => d.label === 'Transport');
    expect(transportEntry).toBeDefined();
    expect(transportEntry!.value).toBe(25000);
  });
});
