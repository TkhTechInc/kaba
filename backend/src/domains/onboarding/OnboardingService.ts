import { Injectable } from '@nestjs/common';
import { OnboardingRepository } from './repositories/OnboardingRepository';
import { BusinessRepository } from '@/domains/business/BusinessRepository';
import type { BusinessType } from '@/domains/ledger/models/Business';
import type {
  OnboardingState,
  OnboardingStep,
  OnboardingAnswers,
} from './models/OnboardingState';
import { NotFoundError } from '@/shared/errors/DomainError';
import { getCurrencyForCountry } from '@/shared/utils/country-currency';

const STEPS: OnboardingStep[] = [
  'businessName',
  'businessType',
  'country',
  'currency',
  'taxRegime',
  'details',
];

export interface OnboardingProgress {
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  answers: OnboardingAnswers;
  isComplete: boolean;
  startedAt: string;
  completedAt?: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly onboardingRepo: OnboardingRepository,
    private readonly businessRepo: BusinessRepository,
  ) {}

  async getProgress(businessId: string, userId: string): Promise<OnboardingProgress> {
    const state = await this.onboardingRepo.getByBusinessId(businessId);
    if (!state) {
      const now = new Date().toISOString();
      const newState: OnboardingState = {
        businessId,
        userId,
        step: 'businessName',
        completedSteps: [],
        answers: {},
        startedAt: now,
      };
      await this.onboardingRepo.upsert(newState);
      return {
        step: 'businessName',
        completedSteps: [],
        answers: {},
        isComplete: false,
        startedAt: now,
      };
    }
    return {
      step: state.step,
      completedSteps: state.completedSteps,
      answers: state.answers,
      isComplete: !!state.completedAt,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
    };
  }

  async updateStep(
    businessId: string,
    userId: string,
    step: OnboardingStep,
    answers: Partial<OnboardingAnswers>,
  ): Promise<OnboardingProgress> {
    let state = await this.onboardingRepo.getByBusinessId(businessId);
    const now = new Date().toISOString();

    if (!state) {
      state = {
        businessId,
        userId,
        step: 'businessName',
        completedSteps: [],
        answers: {},
        startedAt: now,
      };
    }

    const mergedAnswers = { ...state.answers, ...answers };
    const completedSteps = [...new Set([...state.completedSteps, step])];
    const nextStep = this.getNextStep(completedSteps);

    const allStepsComplete = STEPS.every((s) => completedSteps.includes(s));
    const completedAt = allStepsComplete ? (state.completedAt ?? now) : state.completedAt;

    const updated: OnboardingState = {
      ...state,
      step: nextStep,
      completedSteps,
      answers: mergedAnswers,
      startedAt: state.startedAt,
      completedAt,
    };

    await this.onboardingRepo.upsert(updated);

    if (allStepsComplete && !state.completedAt) {
      const currency =
        mergedAnswers.currency?.trim() ||
        (mergedAnswers.country?.trim() ? getCurrencyForCountry(mergedAnswers.country) : undefined);
      await this.businessRepo.updateOnboarding(businessId, {
        name: mergedAnswers.businessName,
        countryCode: mergedAnswers.country,
        currency,
        businessType: mergedAnswers.businessType as import('@/domains/ledger/models/Business').BusinessType | undefined,
        taxRegime: mergedAnswers.taxRegime,
        taxId: mergedAnswers.taxId,
        legalStatus: mergedAnswers.legalStatus as import('@/domains/ledger/models/Business').LegalStatus | undefined,
        rccm: mergedAnswers.rccm,
        address: mergedAnswers.businessAddress,
        phone: mergedAnswers.businessPhone,
        fiscalYearStart: mergedAnswers.fiscalYearStart,
        slug: mergedAnswers.slug,
        description: mergedAnswers.description,
        onboardingComplete: true,
      });
    }

    return {
      step: updated.step,
      completedSteps: updated.completedSteps,
      answers: updated.answers,
      isComplete: !!updated.completedAt,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
    };
  }

  /**
   * Partial update of onboarding answers. Merges with existing and optionally marks complete.
   * Used by the wizard for flexible multi-field updates.
   */
  async patch(
    businessId: string,
    userId: string,
    answers: Partial<OnboardingAnswers>,
    options?: { onboardingComplete?: boolean },
  ): Promise<OnboardingProgress> {
    let state = await this.onboardingRepo.getByBusinessId(businessId);
    const now = new Date().toISOString();

    if (!state) {
      state = {
        businessId,
        userId,
        step: 'businessName',
        completedSteps: [],
        answers: {},
        startedAt: now,
      };
    }

    const mergedAnswers = { ...state.answers, ...answers };
    const completedSteps = [...new Set(state.completedSteps)];
    if (answers.businessName != null && !completedSteps.includes('businessName')) completedSteps.push('businessName');
    if (answers.businessType != null && !completedSteps.includes('businessType')) completedSteps.push('businessType');
    if (answers.country != null && !completedSteps.includes('country')) completedSteps.push('country');
    if (answers.currency != null && !completedSteps.includes('currency')) completedSteps.push('currency');
    if ((answers.taxRegime != null || answers.taxId != null || answers.legalStatus != null || answers.rccm != null) && !completedSteps.includes('taxRegime')) completedSteps.push('taxRegime');
    if (
      (answers.businessAddress != null || answers.businessPhone != null || answers.fiscalYearStart != null) &&
      !completedSteps.includes('details')
    ) {
      completedSteps.push('details');
    }
    completedSteps.sort((a, b) => STEPS.indexOf(a) - STEPS.indexOf(b));
    const nextStep = this.getNextStep(completedSteps);

    const updated: OnboardingState = {
      ...state,
      step: nextStep,
      completedSteps,
      answers: mergedAnswers,
      startedAt: state.startedAt,
      completedAt: options?.onboardingComplete ? now : state.completedAt,
    };

    await this.onboardingRepo.upsert(updated);

    // Always sync to business record when already complete (profile updates) or when completing now.
    const alreadyComplete = !!state.completedAt;
    if (options?.onboardingComplete || alreadyComplete) {
      const currency =
        mergedAnswers.currency?.trim() ||
        (mergedAnswers.country?.trim() ? getCurrencyForCountry(mergedAnswers.country) : undefined);
      await this.businessRepo.updateOnboarding(businessId, {
        name: mergedAnswers.businessName,
        countryCode: mergedAnswers.country,
        currency,
        businessType: mergedAnswers.businessType as BusinessType | undefined,
        taxRegime: mergedAnswers.taxRegime,
        taxId: mergedAnswers.taxId,
        legalStatus: mergedAnswers.legalStatus as import('@/domains/ledger/models/Business').LegalStatus | undefined,
        rccm: mergedAnswers.rccm,
        address: mergedAnswers.businessAddress,
        phone: mergedAnswers.businessPhone,
        fiscalYearStart: mergedAnswers.fiscalYearStart,
        slug: mergedAnswers.slug,
        description: mergedAnswers.description,
        onboardingComplete: options?.onboardingComplete || alreadyComplete,
      });
    }

    return {
      step: updated.step,
      completedSteps: updated.completedSteps,
      answers: updated.answers,
      isComplete: !!updated.completedAt,
      startedAt: updated.startedAt,
      completedAt: updated.completedAt,
    };
  }

  async completeOnboarding(businessId: string, userId: string): Promise<OnboardingProgress> {
    const state = await this.onboardingRepo.getByBusinessId(businessId);
    if (!state) {
      throw new NotFoundError('OnboardingState', businessId);
    }
    if (state.completedAt) {
      return {
        step: state.step,
        completedSteps: state.completedSteps,
        answers: state.answers,
        isComplete: true,
        startedAt: state.startedAt,
        completedAt: state.completedAt,
      };
    }

    const now = new Date().toISOString();
    const completed: OnboardingState = {
      ...state,
      completedAt: now,
    };
    await this.onboardingRepo.upsert(completed);

    const currency =
      state.answers.currency?.trim() ||
      (state.answers.country?.trim() ? getCurrencyForCountry(state.answers.country) : undefined);
    await this.businessRepo.updateOnboarding(businessId, {
      name: state.answers.businessName,
      countryCode: state.answers.country,
      currency,
      businessType: state.answers.businessType as BusinessType | undefined,
      taxRegime: state.answers.taxRegime,
      taxId: state.answers.taxId,
      legalStatus: state.answers.legalStatus as import('@/domains/ledger/models/Business').LegalStatus | undefined,
      rccm: state.answers.rccm,
      address: state.answers.businessAddress,
      phone: state.answers.businessPhone,
      fiscalYearStart: state.answers.fiscalYearStart,
      slug: state.answers.slug,
      description: state.answers.description,
      onboardingComplete: true,
    });

    return {
      step: completed.step,
      completedSteps: completed.completedSteps,
      answers: completed.answers,
      isComplete: true,
      startedAt: completed.startedAt,
      completedAt: completed.completedAt,
    };
  }

  private getNextStep(completedSteps: OnboardingStep[]): OnboardingStep {
    for (const s of STEPS) {
      if (!completedSteps.includes(s)) return s;
    }
    return 'details';
  }
}
