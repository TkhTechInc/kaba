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
  /** IFU (Benin) or NCC (Côte d'Ivoire) — required for fiscal certification */
  taxId?: string;
  businessAddress?: string;
  businessPhone?: string;
  fiscalYearStart?: number;
  /** URL-friendly store slug for public storefront, e.g. "mama-fashion" */
  slug?: string;
  /** Short public description of the business */
  description?: string;
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
