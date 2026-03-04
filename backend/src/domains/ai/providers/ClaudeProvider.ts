/**
 * Anthropic Claude provider — wraps the Anthropic SDK behind ILLMProvider.
 * Install: npm install @anthropic-ai/sdk
 */

import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';

export class ClaudeProvider extends BaseLLMProvider {
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    // Lazy import to avoid hard dependency if provider is not used.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic.default({ apiKey: this.apiKey });

    const messages: { role: 'user'; content: string }[] = [
      { role: 'user', content: request.prompt },
    ];

    const response = await client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 1024,
      system: request.systemPrompt,
      messages,
    });

    const block = response.content[0] as { type: string; text: string } | undefined;
    const text = block?.type === 'text' ? block.text : '';

    return {
      text,
      provider: 'claude',
      model: this.model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const prompt = `${request.prompt}\n\nRespond ONLY with valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;
    const textResponse = await this.generateText({ ...request, prompt });
    const data = this.parseJsonFromText(textResponse.text) as T;
    return { data, provider: 'claude', model: this.model, usage: textResponse.usage };
  }
}
