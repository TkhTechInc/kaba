/**
 * OpenAI provider — wraps the OpenAI SDK behind ILLMProvider.
 * Install: npm install openai
 */

import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';

export class OpenAIProvider extends BaseLLMProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'gpt-4o-mini') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAI = require('openai');
    const client = new OpenAI.default({ apiKey: this.apiKey });

    const messages: { role: 'system' | 'user'; content: string }[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });

    const response = await client.chat.completions.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0.7,
      messages,
    });

    const text = response.choices[0]?.message?.content ?? '';

    return {
      text,
      provider: 'openai',
      model: this.model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const prompt = `${request.prompt}\n\nRespond ONLY with valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;
    const textResponse = await this.generateText({ ...request, prompt });
    const data = this.parseJsonFromText(textResponse.text) as T;
    return { data, provider: 'openai', model: this.model, usage: textResponse.usage };
  }
}
