import { Injectable, Inject } from '@nestjs/common';
import { AI_LLM_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import type { OnboardingStep, OnboardingAnswers } from './models/OnboardingState';

export interface OnboardingAISuggestion {
  businessName?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  taxRegime?: string;
  message?: string;
}

@Injectable()
export class OnboardingAIService {
  constructor(
    @Inject(AI_LLM_PROVIDER) private readonly llm: ILLMProvider,
  ) {}

  async parseUserMessage(
    message: string,
    _step: OnboardingStep,
    _answers: OnboardingAnswers,
  ): Promise<OnboardingAISuggestion> {
    const schema = {
      type: 'object',
      properties: {
        businessName: {
          type: 'string',
          description: 'Business name if mentioned',
        },
        businessType: {
          type: 'string',
          enum: ['retail', 'restaurant', 'services', 'manufacturing', 'agriculture', 'other'],
          description: 'Type of business based on user description',
        },
        country: {
          type: 'string',
          description: 'ISO 3166-1 alpha-2 country code (e.g. NG, GH, BJ) for West African countries',
        },
        currency: {
          type: 'string',
          description: 'ISO 4217 currency code (e.g. NGN, GHS, XOF)',
        },
        taxRegime: {
          type: 'string',
          enum: ['vat', 'simplified', 'none'],
          description: 'Tax regime if mentioned',
        },
        message: {
          type: 'string',
          description: 'Brief friendly response to the user',
        },
      },
    };

    const prompt = `The user is setting up their business in West Africa. They said: "${message}"

Extract any business name, business type, country, currency, or tax regime from their message. Use West African country codes (NG, GH, BJ, SN, CI, TG, etc.) and currencies (NGN, GHS, XOF, etc.). If unclear, omit the field.`;

    const result = await this.llm.generateStructured<OnboardingAISuggestion>({
      prompt,
      systemPrompt:
        'You are a helpful assistant for QuickBooks West Africa. Extract onboarding fields from user messages. Return only fields you can confidently infer. Use ISO codes for country and currency.',
      jsonSchema: schema,
    });

    return result.data;
  }
}
