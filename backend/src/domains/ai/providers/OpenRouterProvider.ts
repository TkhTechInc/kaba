/**
 * OpenRouter LLM provider. OpenAI-compatible API at https://openrouter.ai/api/v1
 * Model format: "anthropic/claude-3.5-sonnet" or "openai/gpt-4o"
 */

import OpenAI from 'openai';
import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';

export class OpenRouterProvider extends BaseLLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    super();
    this.client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
    this.model = model;
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }
    messages.push({ role: 'user', content: request.prompt });
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature,
    });
    const choice = completion.choices?.[0];
    const text = (typeof choice?.message?.content === 'string' ? choice.message.content : '') ?? '';
    const usage = completion.usage
      ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }
      : undefined;
    return { text, provider: 'openrouter', model: this.model, usage };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const system =
      (request.systemPrompt ?? '') +
      '\nRespond ONLY with valid JSON matching this schema: ' +
      JSON.stringify(request.jsonSchema) +
      '. No markdown or explanation.';
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (system) {
      messages.push({ role: 'system', content: system });
    }
    messages.push({ role: 'user', content: request.prompt });
    const completion = await this.client.chat.completions.create({
      model: this.model,
      messages,
      max_tokens: request.maxTokens ?? 1024,
      temperature: request.temperature ?? 0,
      response_format: { type: 'json_object' },
    });
    const choice = completion.choices?.[0];
    const raw = (typeof choice?.message?.content === 'string' ? choice.message.content : '') ?? '{}';
    const data = this.parseJsonFromText(raw) as T;
    const usage = completion.usage
      ? { inputTokens: completion.usage.prompt_tokens, outputTokens: completion.usage.completion_tokens }
      : undefined;
    return { data, provider: 'openrouter', model: this.model, usage };
  }
}
