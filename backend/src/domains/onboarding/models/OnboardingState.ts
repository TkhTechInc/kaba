/**
 * Onboarding state stored per business.
 * Steps: businessName -> businessType -> country -> currency -> taxRegime -> details
 */
export type OnboardingStep =
  | 'businessName'
  | 'businessType'
  | 'country'
  | 'currency'
  | 'taxRegime'
  | 'details';

export interface OnboardingAnswers {
  businessName?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  taxRegime?: string;
  businessAddress?: string;
  businessPhone?: string;
  fiscalYearStart?: number;
}

export interface OnboardingState {
  businessId: string;
  userId: string;
  step: OnboardingStep;
  completedSteps: OnboardingStep[];
  answers: OnboardingAnswers;
  startedAt: string;
  completedAt?: string;
}
