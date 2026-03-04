/**
 * AWS Bedrock provider — uses the AWS SDK v3 behind ILLMProvider.
 * Uses IAM credentials from the environment (instance role / env vars).
 * Install: npm install @aws-sdk/client-bedrock-runtime
 */

import type {
  GenerateTextRequest,
  GenerateTextResponse,
  GenerateStructuredRequest,
  GenerateStructuredResponse,
} from '../ILLMProvider';
import { BaseLLMProvider } from '../ILLMProvider';

export interface BedrockProviderOptions {
  region?: string;
  modelId?: string;
}

export class BedrockProvider extends BaseLLMProvider {
  private readonly region: string;
  private readonly modelId: string;

  constructor(options: BedrockProviderOptions = {}) {
    super();
    this.region = options.region ?? 'us-east-1';
    this.modelId = options.modelId ?? 'meta.llama3-3-70b-instruct-v1:0';
  }

  async generateText(request: GenerateTextRequest): Promise<GenerateTextResponse> {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
    const client = new BedrockRuntimeClient({ region: this.region });

    const isLlama = this.modelId.startsWith('meta.llama');
    const isClaude = this.modelId.startsWith('anthropic.claude');

    let body: unknown;
    if (isClaude) {
      body = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: request.maxTokens ?? 1024,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.prompt }],
      };
    } else if (isLlama) {
      const systemPart = request.systemPrompt ? `<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${request.systemPrompt}<|eot_id|>` : '';
      body = {
        prompt: `${systemPart}<|start_header_id|>user<|end_header_id|>\n${request.prompt}<|eot_id|><|start_header_id|>assistant<|end_header_id|>`,
        max_gen_len: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
      };
    } else {
      throw new Error(`Unsupported Bedrock model: ${this.modelId}`);
    }

    const command = new InvokeModelCommand({
      modelId: this.modelId,
      body: JSON.stringify(body),
      contentType: 'application/json',
      accept: 'application/json',
    });

    const result = await client.send(command);
    const parsed = JSON.parse(new TextDecoder().decode(result.body)) as Record<string, unknown>;

    let text = '';
    if (isClaude) {
      const content = parsed['content'] as Array<{ type: string; text: string }> | undefined;
      text = content?.[0]?.text ?? '';
    } else {
      text = (parsed['generation'] as string) ?? '';
    }

    return { text, provider: 'bedrock', model: this.modelId };
  }

  async generateStructured<T>(
    request: GenerateStructuredRequest<T>,
  ): Promise<GenerateStructuredResponse<T>> {
    const prompt = `${request.prompt}\n\nRespond ONLY with valid JSON that matches this schema:\n${JSON.stringify(request.jsonSchema, null, 2)}`;
    const textResponse = await this.generateText({ ...request, prompt });
    const data = this.parseJsonFromText(textResponse.text) as T;
    return { data, provider: 'bedrock', model: this.modelId };
  }
}
