import { OnboardingService } from '../OnboardingService';
import { OnboardingRepository } from '../repositories/OnboardingRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import { NotFoundError } from '@/shared/errors/DomainError';
import type { OnboardingState, OnboardingStep } from '../models/OnboardingState';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    businessId: 'biz-001',
    userId: 'user-001',
    step: 'businessName',
    completedSteps: [],
    answers: {},
    startedAt: '2026-03-01T10:00:00.000Z',
    ...overrides,
  };
}

function makeMocks() {
  const onboardingRepo = {
    getByBusinessId: jest.fn(),
    upsert: jest.fn(),
  } as unknown as jest.Mocked<Pick<OnboardingRepository, 'getByBusinessId' | 'upsert'>>;

  const businessRepo = {
    updateOnboarding: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<Pick<BusinessRepository, 'updateOnboarding'>>;

  const service = new OnboardingService(
    onboardingRepo as OnboardingRepository,
    businessRepo as BusinessRepository,
  );

  return { service, onboardingRepo, businessRepo };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingService', () => {
  describe('getProgress (getState)', () => {
    it('returns new state when none exists and upserts it', async () => {
      const { service, onboardingRepo } = makeMocks();
      onboardingRepo.getByBusinessId.mockResolvedValue(null);
      onboardingRepo.upsert.mockImplementation(async (s) => s);

      const result = await service.getProgress('biz-001', 'user-001');

      expect(result.step).toBe('businessName');
      expect(result.completedSteps).toEqual([]);
      expect(result.answers).toEqual({});
      expect(result.isComplete).toBe(false);
      expect(result.startedAt).toBeDefined();
      expect(onboardingRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          businessId: 'biz-001',
          userId: 'user-001',
          step: 'businessName',
          completedSteps: [],
          answers: {},
        }),
      );
    });

    it('returns existing state when found', async () => {
      const { service, onboardingRepo } = makeMocks();
      const state = makeState({
        step: 'country',
        completedSteps: ['businessName', 'businessType'],
        answers: { businessName: 'Marché Dantokpa', businessType: 'retail' },
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);

      const result = await service.getProgress('biz-001', 'user-001');

      expect(result.step).toBe('country');
      expect(result.completedSteps).toEqual(['businessName', 'businessType']);
      expect(result.answers).toEqual({ businessName: 'Marché Dantokpa', businessType: 'retail' });
      expect(result.isComplete).toBe(false);
      expect(onboardingRepo.upsert).not.toHaveBeenCalled();
    });

    it('returns isComplete true when completedAt is set', async () => {
      const { service, onboardingRepo } = makeMocks();
      const state = makeState({
        completedAt: '2026-03-05T12:00:00.000Z',
        completedSteps: ['businessName', 'businessType', 'country', 'currency', 'taxRegime', 'details'],
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);

      const result = await service.getProgress('biz-001', 'user-001');

      expect(result.isComplete).toBe(true);
      expect(result.completedAt).toBe('2026-03-05T12:00:00.000Z');
    });
  });

  describe('updateStep (updateState)', () => {
    it('merges answers and advances step', async () => {
      const { service, onboardingRepo, businessRepo } = makeMocks();
      const state = makeState({
        step: 'businessName',
        completedSteps: [],
        answers: {},
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);
      onboardingRepo.upsert.mockImplementation(async (s) => s);

      const result = await service.updateStep(
        'biz-001',
        'user-001',
        'businessName' as OnboardingStep,
        { businessName: 'Marché Dantokpa' },
      );

      expect(result.answers.businessName).toBe('Marché Dantokpa');
      expect(result.completedSteps).toContain('businessName');
      expect(result.step).toBe('businessType');
      expect(onboardingRepo.upsert).toHaveBeenCalled();
      expect(businessRepo.updateOnboarding).not.toHaveBeenCalled();
    });

    it('creates state when none exists', async () => {
      const { service, onboardingRepo } = makeMocks();
      onboardingRepo.getByBusinessId.mockResolvedValue(null);
      onboardingRepo.upsert.mockImplementation(async (s) => s);

      const result = await service.updateStep(
        'biz-001',
        'user-001',
        'businessName' as OnboardingStep,
        { businessName: 'New Business' },
      );

      expect(result.answers.businessName).toBe('New Business');
      expect(onboardingRepo.upsert).toHaveBeenCalled();
    });

    it('calls businessRepo.updateOnboarding when all steps complete', async () => {
      const { service, onboardingRepo, businessRepo } = makeMocks();
      const state = makeState({
        step: 'details',
        completedSteps: ['businessName', 'businessType', 'country', 'currency', 'taxRegime'],
        answers: {
          businessName: 'Marché Dantokpa',
          businessType: 'retail',
          country: 'BJ',
          currency: 'XOF',
          taxRegime: 'simplified',
        },
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);
      onboardingRepo.upsert.mockImplementation(async (s) => s);

      await service.updateStep(
        'biz-001',
        'user-001',
        'details' as OnboardingStep,
        { businessAddress: 'Cotonou', businessPhone: '+22912345678' },
      );

      expect(businessRepo.updateOnboarding).toHaveBeenCalledWith(
        'biz-001',
        expect.objectContaining({
          name: 'Marché Dantokpa',
          countryCode: 'BJ',
          currency: 'XOF',
          onboardingComplete: true,
        }),
      );
    });
  });

  describe('completeOnboarding (markComplete)', () => {
    it('marks state complete and updates business', async () => {
      const { service, onboardingRepo, businessRepo } = makeMocks();
      const state = makeState({
        step: 'details',
        completedSteps: ['businessName', 'businessType', 'country', 'currency', 'taxRegime', 'details'],
        answers: {
          businessName: 'Marché Dantokpa',
          businessType: 'retail',
          country: 'BJ',
          currency: 'XOF',
          taxRegime: 'simplified',
        },
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);
      onboardingRepo.upsert.mockImplementation(async (s) => s);

      const result = await service.completeOnboarding('biz-001', 'user-001');

      expect(result.isComplete).toBe(true);
      expect(result.completedAt).toBeDefined();
      expect(businessRepo.updateOnboarding).toHaveBeenCalledWith(
        'biz-001',
        expect.objectContaining({ onboardingComplete: true }),
      );
    });

    it('throws NotFoundError when state does not exist', async () => {
      const { service, onboardingRepo } = makeMocks();
      onboardingRepo.getByBusinessId.mockResolvedValue(null);

      await expect(
        service.completeOnboarding('biz-001', 'user-001'),
      ).rejects.toThrow(NotFoundError);
    });

    it('returns existing state unchanged when already complete', async () => {
      const { service, onboardingRepo, businessRepo } = makeMocks();
      const state = makeState({
        completedAt: '2026-03-05T12:00:00.000Z',
        completedSteps: ['businessName', 'businessType', 'country', 'currency', 'taxRegime', 'details'],
      });
      onboardingRepo.getByBusinessId.mockResolvedValue(state);

      const result = await service.completeOnboarding('biz-001', 'user-001');

      expect(result.isComplete).toBe(true);
      expect(result.completedAt).toBe('2026-03-05T12:00:00.000Z');
      expect(onboardingRepo.upsert).not.toHaveBeenCalled();
      expect(businessRepo.updateOnboarding).not.toHaveBeenCalled();
    });
  });
});
