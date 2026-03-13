import { Injectable, Inject, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { AI_LEDGER_QA_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import { FeatureService } from '@/domains/features/FeatureService';
import type { Tier } from '@/domains/features/feature.types';
import { AgentSessionStore } from './AgentSessionStore';
import { ToolRegistry } from './ToolRegistry';
import type { IAgentSession, AgentMessage } from './interfaces/IAgentSession';
import type { McpScope, McpToolContext } from './interfaces/IMcpTool';

export interface AgentChatInput {
  sessionId: string;
  message: string;
  businessId: string;
  userId?: string;
  customerEmail?: string;
  tier: Tier;
  scope: McpScope;
}

export interface AgentChatResponse {
  message: string;
  sessionId: string;
  toolsUsed: string[];
  upgradeRequired?: { feature: string; requiredTier: Tier };
}

const WRITE_TOOLS = new Set(['record_sale', 'record_expense', 'create_invoice', 'pay_supplier']);
const MAX_MESSAGES = 30;
const MAX_ITERATIONS = 5;

function buildSystemPrompt(toolList: string): string {
  return `You are Kaba AI, a financial assistant for West African small businesses.
You help business owners track sales, expenses, invoices, debts, inventory, and suppliers.
You speak naturally and concisely. Support English, French, and common West African expressions.

When you need data to answer, emit a tool call as JSON on its own line:
{"tool_call": {"name": "<tool_name>", "input": {<arguments>}}}

Available tools:
${toolList}

After getting tool results, provide a clear, friendly answer. Do not emit tool calls in your final answer.`;
}

function buildPromptFromMessages(messages: AgentMessage[]): string {
  return messages
    .map(m => {
      if (m.role === 'user') return `User: ${m.content}`;
      if (m.role === 'assistant') return `Assistant: ${m.content}`;
      return `Tool (${m.toolName ?? 'unknown'}): ${m.content}`;
    })
    .join('\n');
}

function parseToolCall(text: string): { name: string; input: Record<string, unknown> } | null {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{"tool_call"')) continue;
    try {
      const parsed = JSON.parse(trimmed) as { tool_call?: { name?: string; input?: Record<string, unknown> } };
      if (parsed.tool_call?.name) {
        return {
          name: parsed.tool_call.name,
          input: parsed.tool_call.input ?? {},
        };
      }
    } catch {
      // not valid JSON, continue
    }
  }
  return null;
}

@Injectable()
export class AgentOrchestrator {
  private readonly logger = new Logger(AgentOrchestrator.name);

  constructor(
    @Inject(AI_LEDGER_QA_PROVIDER) private readonly llmProvider: ILLMProvider,
    private readonly sessionStore: AgentSessionStore,
    private readonly toolRegistry: ToolRegistry,
    private readonly featureService: FeatureService,
  ) {}

  async chat(input: AgentChatInput): Promise<AgentChatResponse> {
    const { sessionId: inputSessionId, message, businessId, userId, customerEmail, tier, scope } = input;
    const sessionId = inputSessionId || uuidv4();

    if (!this.featureService.isEnabled('mcp_agent_basic', tier)) {
      return {
        message: 'The AI Agent feature requires a Starter plan or higher. Please upgrade to continue.',
        sessionId,
        toolsUsed: [],
        upgradeRequired: { feature: 'mcp_agent_basic', requiredTier: 'starter' },
      };
    }

    let session = await this.sessionStore.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        scope,
        businessId,
        userId,
        customerEmail,
        messages: [],
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      };
    }

    session.messages.push({ role: 'user', content: message });

    const toolDefs = this.toolRegistry.getToolsForScope(scope);
    const toolList = toolDefs
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    const systemPrompt = buildSystemPrompt(toolList);
    const toolsUsed: string[] = [];
    let finalMessage = '';

    const ctx: McpToolContext = { businessId, userId, customerEmail, tier, scope };

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const prompt = buildPromptFromMessages(session.messages);

      let responseText: string;
      try {
        const result = await this.llmProvider.generateText({ prompt, systemPrompt, maxTokens: 1024 });
        responseText = result.text;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.logger.error(`LLM error on iteration ${i}: ${errMsg}`);
        finalMessage = 'Sorry, I encountered an error. Please try again.';
        break;
      }

      const toolCall = parseToolCall(responseText);

      if (!toolCall) {
        finalMessage = responseText.trim();
        session.messages.push({ role: 'assistant', content: finalMessage });
        break;
      }

      const { name: toolName, input: toolInput } = toolCall;

      if (WRITE_TOOLS.has(toolName) && !this.featureService.isEnabled('mcp_agent_advanced', tier)) {
        const upgradeMsg = `The "${toolName}" action requires a Pro plan. Please upgrade to use write tools.`;
        session.messages.push({ role: 'assistant', content: upgradeMsg });
        finalMessage = upgradeMsg;
        break;
      }

      const tool = this.toolRegistry.getTool(toolName);
      let toolResult: unknown;
      if (!tool || !tool.execute) {
        toolResult = { error: `Unknown tool: ${toolName}` };
      } else {
        try {
          toolResult = await tool.execute(toolInput, ctx);
          toolsUsed.push(toolName);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Tool ${toolName} failed: ${errMsg}`);
          toolResult = { error: errMsg };
        }
      }

      const toolResultStr = JSON.stringify(toolResult);
      session.messages.push({ role: 'tool', content: toolResultStr, toolName });
    }

    if (session.messages.length > MAX_MESSAGES) {
      session.messages = session.messages.slice(-MAX_MESSAGES);
    }

    try {
      await this.sessionStore.save(session);
    } catch (err) {
      this.logger.warn(`Failed to save session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    return { message: finalMessage, sessionId, toolsUsed };
  }
}
