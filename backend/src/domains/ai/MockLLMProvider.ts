/**
 * Mock LLM provider for development.
 * Returns stub responses without calling external APIs.
 */

import type {
  ILLMProvider,
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from './ILLMProvider';

export class MockLLMProvider implements ILLMProvider {
  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    return {
      text: `[Mock] Response to: ${request.prompt.slice(0, 50)}...`,
      provider: 'mock',
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 20 },
    };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const schema = request.jsonSchema as { properties?: { category?: { enum?: string[] } } };
    const categoryEnum = schema?.properties?.category?.enum;
    const defaultData = categoryEnum?.length
      ? ({ category: categoryEnum[0] } as T)
      : ({} as T);
    return {
      data: defaultData,
      provider: 'mock',
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }
}
