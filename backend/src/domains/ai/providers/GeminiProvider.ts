/**
 * Google Gemini provider — wraps the Google Generative AI SDK behind ILLMProvider.
 * Install: npm install @google/generative-ai
 */

import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';

export class GeminiProvider extends BaseLLMProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gemini-2.5-flash') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const client = new GoogleGenerativeAI(this.apiKey);

    const generationConfig = {
      maxOutputTokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
    };

    const geminiModel = client.getGenerativeModel({
      model: this.model,
      systemInstruction: request.systemPrompt,
      generationConfig,
    });

    const result = await geminiModel.generateContent(request.prompt) as {
      response: {
        text(): string;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      };
    };
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      text,
      provider: 'gemini',
      model: this.model,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
    };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const prompt = `${request.prompt}\n\nRespond ONLY with valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;
    const textResponse = await this.generateText({ ...request, prompt });
    const data = this.parseJsonFromText(textResponse.text) as T;
    return { data, provider: 'gemini', model: this.model, usage: textResponse.usage };
  }
}
