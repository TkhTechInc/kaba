import { ChatOrchestrator } from '../services/ChatOrchestrator';
import { IntentParserService } from '../services/IntentParserService';
import { ChatUserResolver } from '../services/ChatUserResolver';
import type { IConversationStore, ChatSession } from '../interfaces/IConversationStore';
import type { IIntentParser, ParsedIntent } from '../interfaces/IIntentParser';
import type { IMessagingChannel, IncomingMessage } from '../interfaces/IMessagingChannel';
import type { LedgerService } from '../../ledger/services/LedgerService';
import type { InvoiceService } from '../../invoicing/services/InvoiceService';
import type { DebtService } from '../../debts/services/DebtService';
import type { BusinessTrustScoreService } from '../../trust/BusinessTrustScoreService';
import type { VoiceToTransactionService } from '../../ai/VoiceToTransactionService';
import type { ReportService } from '../../reports/ReportService';
import type { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import type { AccessService } from '../../access/AccessService';
import type { ILLMProvider } from '../../ai/ILLMProvider';

// ---------------------------------------------------------------------------
// In-memory IConversationStore
// ---------------------------------------------------------------------------
class InMemoryConversationStore implements IConversationStore {
  private store = new Map<string, ChatSession>();

  async get(sessionId: string): Promise<ChatSession | null> {
    return this.store.get(sessionId) ?? null;
  }

  async save(session: ChatSession): Promise<void> {
    this.store.set(session.id, { ...session });
  }

  async delete(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}

// ---------------------------------------------------------------------------
// Helpers to build mocks
// ---------------------------------------------------------------------------
function makeMockChannel(name: 'whatsapp' | 'telegram' = 'whatsapp'): IMessagingChannel & {
  send: jest.Mock;
  parseIncoming: jest.Mock;
} {
  return {
    channelName: name,
    send: jest.fn().mockResolvedValue(undefined),
    parseIncoming: jest.fn().mockReturnValue(null),
  };
}

function makeMockIntentParser(): IIntentParser & { parse: jest.Mock } {
  return {
    parse: jest.fn().mockResolvedValue({
      type: 'unknown',
      entities: {},
      confidence: 0,
      rawText: '',
    } as ParsedIntent),
  };
}

const FIXED_NOW = '2026-03-07T12:00:00.000Z';

function makeIncoming(
  text: string,
  channelUserId = '+22890000001',
  channel: 'whatsapp' | 'telegram' = 'whatsapp',
): IncomingMessage {
  return {
    channelUserId,
    text,
    channel,
    timestamp: FIXED_NOW,
  };
}

function makeMockLedgerService(balance = 125000) {
  return {
    getBalance: jest.fn().mockResolvedValue({ businessId: 'biz-1', balance, currency: 'XOF' }),
    createEntry: jest.fn(),
  } as unknown as LedgerService;
}

function makeMockInvoiceService() {
  return {
    listUnpaid: jest.fn().mockResolvedValue([]),
  } as unknown as InvoiceService;
}

function makeMockDebtService() {
  return {
    list: jest.fn().mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 }),
  } as unknown as DebtService;
}

function makeMockTrustService() {
  return {
    calculate: jest.fn().mockResolvedValue({
      businessId: 'biz-1',
      trustScore: 72,
      breakdown: {
        repaymentVelocity: 0,
        transactionRecency: 0,
        momoReconciliation: 0,
        customerRetention: 0,
        networkDiversity: 0,
      },
      marketDayAwarenessApplied: false,
      recommendation: 'good',
      scoredAt: new Date().toISOString(),
    }),
  } as unknown as BusinessTrustScoreService;
}

function makeMockVoiceService() {
  return {
    processFromText: jest.fn().mockResolvedValue({ success: true, entry: { id: 'e-1', type: 'sale', amount: 15000, description: 'Rice sale', category: 'Food' } }),
  } as unknown as VoiceToTransactionService;
}

function makeMockReportService() {
  return {
    getPL: jest.fn().mockResolvedValue({
      period: { start: '2026-03-01', end: '2026-03-07' },
      totalIncome: 100000,
      totalExpenses: 30000,
      netProfit: 70000,
      currency: 'XOF',
      byCategory: [],
    }),
  } as unknown as ReportService;
}

function makeMockUserRepository(user: { id: string; email?: string; phone?: string } | null = null) {
  return {
    getByPhone: jest.fn().mockResolvedValue(user),
    getByEmail: jest.fn().mockResolvedValue(user),
  } as unknown as UserRepository;
}

function makeMockAccessService(businessId = 'biz-1') {
  return {
    listBusinessesForUser: jest.fn().mockResolvedValue([{ businessId, role: 'owner' }]),
  } as unknown as AccessService;
}

// ---------------------------------------------------------------------------
// Build a fully-wired ChatOrchestrator
// ---------------------------------------------------------------------------
interface OrchestratorFixture {
  orchestrator: ChatOrchestrator;
  store: InMemoryConversationStore;
  intentParser: IIntentParser & { parse: jest.Mock };
  channel: IMessagingChannel & { send: jest.Mock; parseIncoming: jest.Mock };
  userResolver: ChatUserResolver;
  ledgerService: ReturnType<typeof makeMockLedgerService>;
  invoiceService: ReturnType<typeof makeMockInvoiceService>;
  debtService: ReturnType<typeof makeMockDebtService>;
  trustService: ReturnType<typeof makeMockTrustService>;
  voiceService: ReturnType<typeof makeMockVoiceService>;
  reportService: ReturnType<typeof makeMockReportService>;
  mockUserRepo: ReturnType<typeof makeMockUserRepository>;
  mockAccessService: ReturnType<typeof makeMockAccessService>;
}

function buildFixture(opts: {
  channelName?: 'whatsapp' | 'telegram';
  resolvedUser?: { id: string; email?: string; phone?: string } | null;
  noAutoLink?: boolean;
} = {}): OrchestratorFixture {
  const store = new InMemoryConversationStore();
  const intentParser = makeMockIntentParser();
  const channelName = opts.channelName ?? 'whatsapp';
  const channel = makeMockChannel(channelName);

  const resolvedUser = opts.resolvedUser !== undefined ? opts.resolvedUser : null;
  const mockUserRepo = makeMockUserRepository(resolvedUser);
  const mockAccessService = makeMockAccessService();

  const userResolver = new ChatUserResolver(mockUserRepo, mockAccessService);

  const ledgerService = makeMockLedgerService();
  const invoiceService = makeMockInvoiceService();
  const debtService = makeMockDebtService();
  const trustService = makeMockTrustService();
  const voiceService = makeMockVoiceService();
  const reportService = makeMockReportService();

  const orchestrator = new ChatOrchestrator(
    store,
    intentParser,
    [channel],
    userResolver,
    ledgerService,
    invoiceService,
    debtService,
    trustService,
    voiceService,
    reportService,
  );

  return {
    orchestrator,
    store,
    intentParser,
    channel,
    userResolver,
    ledgerService,
    invoiceService,
    debtService,
    trustService,
    voiceService,
    reportService,
    mockUserRepo,
    mockAccessService,
  };
}

// Helper: extract the text from the first channel.send call
function getSentText(channel: { send: jest.Mock }): string {
  return channel.send.mock.calls[0]?.[0]?.text ?? '';
}

// ---------------------------------------------------------------------------
// TESTS
// ---------------------------------------------------------------------------

describe('ChatOrchestrator — Account linking flow', () => {
  it('1. New unlinked WhatsApp user sends greeting → receives REGISTRATION_PROMPT', async () => {
    const { orchestrator, channel } = buildFixture({ resolvedUser: null });

    await orchestrator.handle(makeIncoming('Hi there!'));

    const text = getSentText(channel);
    expect(text).toContain('Welcome to Kaba');
    expect(text).toContain('LINK');
    expect(text).not.toContain('balance');
  });

  it('2. Unlinked user sends "LINK amara@gmail.com" with valid email → linked, success message', async () => {
    const { orchestrator, channel, store, mockUserRepo } = buildFixture({
      resolvedUser: null,
    });

    // Pre-seed: resolveByEmail will find the user
    mockUserRepo.getByEmail = jest.fn().mockResolvedValue({ id: 'usr-1', email: 'amara@gmail.com', provider: 'local', createdAt: '', updatedAt: '' });

    await orchestrator.handle(makeIncoming('LINK amara@gmail.com'));

    const text = getSentText(channel);
    expect(text).toContain('Linked');

    // Session should be persisted as linked
    const session = await store.get('+22890000001:whatsapp');
    expect(session).not.toBeNull();
    expect(session!.linked).toBe(true);
    expect(session!.businessId).toBe('biz-1');
  });

  it('3. Unlinked user sends "LINK unknown@example.com" with unknown email → error, session stays unlinked', async () => {
    const { orchestrator, channel, store, mockUserRepo } = buildFixture({
      resolvedUser: null,
    });

    mockUserRepo.getByEmail = jest.fn().mockResolvedValue(null);

    await orchestrator.handle(makeIncoming('LINK unknown@example.com'));

    const text = getSentText(channel);
    expect(text).toContain('No Kaba account found');
    expect(text).toContain('unknown@example.com');

    const session = await store.get('+22890000001:whatsapp');
    expect(session?.linked).toBeFalsy();
  });

  it('4. WhatsApp user whose phone is in UserRepository → auto-linked on first message', async () => {
    const knownUser = { id: 'usr-phone-1', phone: '+22890000001', provider: 'phone' as const, createdAt: '', updatedAt: '' };
    const { orchestrator, channel, store, intentParser } = buildFixture({
      resolvedUser: knownUser,
    });

    intentParser.parse = jest.fn().mockResolvedValue({
      type: 'check_balance',
      entities: {},
      confidence: 0.95,
      rawText: 'Hi',
    } as ParsedIntent);

    await orchestrator.handle(makeIncoming('Hi'));

    const session = await store.get('+22890000001:whatsapp');
    expect(session?.linked).toBe(true);
    // Should NOT see the registration prompt
    const text = getSentText(channel);
    expect(text).not.toContain('Welcome to Kaba');
  });

  it('5. Telegram user (no phone) → always gets REGISTRATION_PROMPT on first message', async () => {
    const { orchestrator, channel } = buildFixture({
      channelName: 'telegram',
      resolvedUser: null,
    });

    await orchestrator.handle(makeIncoming('Hello', 'tg-123456', 'telegram'));

    const text = getSentText(channel);
    expect(text).toContain('Welcome to Kaba');
    expect(text).toContain('LINK');
  });
});

describe('ChatOrchestrator — Intent dispatch (linked sessions)', () => {
  /** Pre-seed a linked session so we bypass the linking flow */
  async function seedLinkedSession(store: InMemoryConversationStore, sessionId = '+22890000001:whatsapp') {
    const session: ChatSession = {
      id: sessionId,
      businessId: 'biz-1',
      userId: 'usr-1',
      channel: 'whatsapp',
      channelUserId: '+22890000001',
      history: [],
      linked: true,
      updatedAt: new Date().toISOString(),
    };
    await store.save(session);
  }

  it('6. Linked user sends check_balance intent → LedgerService.getBalance called, balance text returned', async () => {
    const { orchestrator, channel, store, intentParser, ledgerService } = buildFixture({ resolvedUser: null });
    await seedLinkedSession(store);

    intentParser.parse = jest.fn().mockResolvedValue({ type: 'check_balance', entities: {}, confidence: 0.9, rawText: 'check my balance' } as ParsedIntent);

    await orchestrator.handle(makeIncoming('check my balance'));

    expect(ledgerService.getBalance).toHaveBeenCalledWith('biz-1');
    const text = getSentText(channel);
    // ledgerService returns balance: 125000 → formatted as "125,000" by toLocaleString
    expect(text).toMatch(/125[,.]?000|125000/);
    expect(text).toContain('XOF');
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('Error');
  });

  it('7. Linked user sends record_sale intent → VoiceToTransactionService.processFromText called, confirmation returned', async () => {
    const { orchestrator, channel, store, intentParser, voiceService } = buildFixture({ resolvedUser: null });
    await seedLinkedSession(store);

    intentParser.parse = jest.fn().mockResolvedValue({
      type: 'record_sale',
      entities: { currency: 'XOF' },
      confidence: 0.95,
      rawText: 'I sold rice for 5000',
    } as ParsedIntent);

    await orchestrator.handle(makeIncoming('I sold rice for 5000'));

    expect(voiceService.processFromText).toHaveBeenCalledWith('I sold rice for 5000', 'biz-1', 'XOF');
    const text = getSentText(channel);
    // voiceService returns amount: 15000 → formatted as "15,000" by toLocaleString
    expect(text).toContain('Recorded sale');
    expect(text).toMatch(/15[,.]?000|15000/);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('Error');
  });

  it('8. Linked user sends list_unpaid_invoices intent → InvoiceService.listUnpaid called', async () => {
    const { orchestrator, channel, store, intentParser, invoiceService } = buildFixture({ resolvedUser: null });
    await seedLinkedSession(store);

    intentParser.parse = jest.fn().mockResolvedValue({ type: 'list_unpaid_invoices', entities: {}, confidence: 0.9, rawText: 'list unpaid invoices' } as ParsedIntent);

    await orchestrator.handle(makeIncoming('list unpaid invoices'));

    expect(invoiceService.listUnpaid).toHaveBeenCalledWith('biz-1');
    const text = getSentText(channel);
    expect(text).toContain('unpaid');
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('Error');
  });

  it('9. Linked user sends get_trust_score intent → BusinessTrustScoreService.calculate called', async () => {
    const { orchestrator, channel, store, intentParser, trustService } = buildFixture({ resolvedUser: null });
    await seedLinkedSession(store);

    intentParser.parse = jest.fn().mockResolvedValue({ type: 'get_trust_score', entities: {}, confidence: 0.88, rawText: 'my trust score' } as ParsedIntent);

    await orchestrator.handle(makeIncoming('my trust score'));

    expect(trustService.calculate).toHaveBeenCalledWith('biz-1');
    const text = getSentText(channel);
    // trustService returns trustScore: 72
    expect(text).toContain('72');
    expect(text).toMatch(/Trust Score|trust score/i);
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('Error');
  });

  it('10. Linked user sends unknown intent → returns help text without crashing', async () => {
    const { orchestrator, channel, store, intentParser } = buildFixture({ resolvedUser: null });
    await seedLinkedSession(store);

    intentParser.parse = jest.fn().mockResolvedValue({ type: 'unknown', entities: {}, confidence: 0, rawText: 'blah blah' } as ParsedIntent);

    await expect(orchestrator.handle(makeIncoming('blah blah'))).resolves.not.toThrow();
    const text = getSentText(channel);
    expect(text).toContain("I didn't understand");
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toContain('Error');
  });
});

// ---------------------------------------------------------------------------
// IntentParserService
// ---------------------------------------------------------------------------
describe('IntentParserService', () => {
  function buildParser(llmResponse: Partial<ParsedIntent> | 'throw'): IntentParserService {
    const mockGenerateStructured = llmResponse === 'throw'
      ? jest.fn().mockRejectedValue(new Error('LLM error'))
      : jest.fn().mockResolvedValue({
          data: {
            type: llmResponse.type ?? 'unknown',
            entities: llmResponse.entities ?? {},
            confidence: llmResponse.confidence ?? 1,
          },
          provider: 'mock',
          model: 'mock',
        });

    const llm: ILLMProvider = {
      generateText: jest.fn(),
      generateStructured: mockGenerateStructured,
    };

    // IntentParserService uses @Inject(AI_INTENT_PARSER_PROVIDER) for the LLM;
    // we pass it directly as the first constructor arg.
    return new IntentParserService(llm);
  }

  it('11. parse French sale message → returns record_sale ParsedIntent', async () => {
    const parser = buildParser({ type: 'record_sale', entities: { amount: 5000, currency: 'XOF' }, confidence: 0.95 });
    const result = await parser.parse("j'ai vendu du riz pour 5000 XOF");
    expect(result.type).toBe('record_sale');
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.rawText).toBe("j'ai vendu du riz pour 5000 XOF");
  });

  it('12. parse "check my balance" → returns check_balance ParsedIntent', async () => {
    const parser = buildParser({ type: 'check_balance', entities: {}, confidence: 0.9 });
    const result = await parser.parse('check my balance');
    expect(result.type).toBe('check_balance');
    expect(result.rawText).toBe('check my balance');
  });

  it('13. LLM error → returns { type: "unknown", confidence: 0 }', async () => {
    const parser = buildParser('throw');
    const result = await parser.parse('some text');
    expect(result.type).toBe('unknown');
    expect(result.confidence).toBe(0);
    expect(result.rawText).toBe('some text');
  });
});

// ---------------------------------------------------------------------------
// ChatUserResolver
// ---------------------------------------------------------------------------
describe('ChatUserResolver', () => {
  const dummyUser = { id: 'usr-42', email: 'amara@gmail.com', phone: '+22890000042', provider: 'phone' as const, createdAt: '', updatedAt: '' };

  it('14. resolveByPhone — calls userRepo.getByPhone then accessService.listBusinessesForUser', async () => {
    const userRepo = makeMockUserRepository(dummyUser);
    const accessService = makeMockAccessService('biz-42');
    const resolver = new ChatUserResolver(userRepo, accessService);

    const result = await resolver.resolveByPhone('+22890000042');

    expect(userRepo.getByPhone).toHaveBeenCalledWith('+22890000042');
    expect(accessService.listBusinessesForUser).toHaveBeenCalledWith('usr-42');
    expect(result).toEqual({ userId: 'usr-42', businessId: 'biz-42' });
  });

  it('15. resolveByPhone — returns null if user not found', async () => {
    const userRepo = makeMockUserRepository(null);
    const accessService = makeMockAccessService();
    const resolver = new ChatUserResolver(userRepo, accessService);

    const result = await resolver.resolveByPhone('+22800000000');
    expect(result).toBeNull();
    expect(accessService.listBusinessesForUser).not.toHaveBeenCalled();
  });

  it('16. resolveByEmail — finds user by email and returns businessId', async () => {
    const userRepo = makeMockUserRepository(dummyUser);
    const accessService = makeMockAccessService('biz-42');
    const resolver = new ChatUserResolver(userRepo, accessService);

    const result = await resolver.resolveByEmail('Amara@Gmail.com'); // tests toLowerCase/trim
    expect(userRepo.getByEmail).toHaveBeenCalledWith('amara@gmail.com');
    expect(result).toEqual({ userId: 'usr-42', businessId: 'biz-42' });
  });

  it('17. resolveByChannelUserId — whatsapp calls resolveByPhone; telegram returns null', async () => {
    const userRepo = makeMockUserRepository(dummyUser);
    const accessService = makeMockAccessService('biz-42');
    const resolver = new ChatUserResolver(userRepo, accessService);

    const waResult = await resolver.resolveByChannelUserId('+22890000042', 'whatsapp');
    expect(userRepo.getByPhone).toHaveBeenCalledWith('+22890000042');
    expect(waResult).toEqual({ userId: 'usr-42', businessId: 'biz-42' });

    const tgResult = await resolver.resolveByChannelUserId('123456789', 'telegram');
    expect(tgResult).toBeNull();
  });
});
