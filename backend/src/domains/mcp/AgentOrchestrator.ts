import { Injectable, Inject, Logger, Optional } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import type { ILLMProvider } from '@/domains/ai/ILLMProvider';
import { AI_LEDGER_QA_PROVIDER } from '@/nest/modules/ai/ai.tokens';
import { FeatureService } from '@/domains/features/FeatureService';
import type { Tier } from '@/domains/features/feature.types';
import { AgentSessionStore } from './AgentSessionStore';
import { ToolRegistry } from './ToolRegistry';
import type { IAgentSession, AgentMessage } from './interfaces/IAgentSession';
import type { McpScope, McpToolContext } from './interfaces/IMcpTool';
import type { IMessagingChannel } from '@/domains/chat/interfaces/IMessagingChannel';
import type { AgentMemory } from '@/domains/business/BusinessMemoryRepository';
import { BusinessMemoryRepository } from '@/domains/business/BusinessMemoryRepository';

const MESSAGING_CHANNELS = 'MESSAGING_CHANNELS';

export interface AgentChatInput {
  sessionId: string;
  message: string;
  businessId: string;
  userId?: string;
  customerEmail?: string;
  tier: Tier;
  scope: McpScope;
  channelUserId?: string;
  channelName?: 'whatsapp' | 'telegram';
}

export interface AgentChatResponse {
  message: string;
  sessionId: string;
  toolsUsed: string[];
  upgradeRequired?: { feature: string; requiredTier: Tier };
}

const WRITE_TOOLS = new Set([
  'record_sale',
  'record_expense',
  'create_invoice',
  'pay_supplier',
  'add_debt',
  'update_inventory',
  'send_debt_reminder',
]);
const MAX_MESSAGES = 30;
const MAX_ITERATIONS = 5;

function buildMemorySection(memory: AgentMemory | null): string {
  if (!memory) return '';
  const parts: string[] = [];
  if (memory.defaultCurrency) parts.push(`Default currency: ${memory.defaultCurrency}`);
  if (memory.frequentProducts?.length)
    parts.push(`Frequent products: ${memory.frequentProducts.join(', ')}`);
  if (memory.topCustomers?.length) parts.push(`Top customers: ${memory.topCustomers.join(', ')}`);
  if (parts.length === 0) return '';
  return `\nMERCHANT PREFERENCES (use this to auto-suggest):\n${parts.join('\n')}\n`;
}

function buildSystemPrompt(toolList: string, memory?: AgentMemory | null): string {
  const memorySection = buildMemorySection(memory ?? null);
  return `You are Kaba AI, the AI CFO for West African small businesses.
You help merchants track sales, expenses, invoices, debts, inventory, suppliers, and get financial insights.
You are friendly, concise, and culturally aware. You operate across Francophone and Anglophone West Africa.

LANGUAGE: Respond in the same language the user writes in. Support English, French, and West African expressions.
- "CFA" or "francs" = XOF currency
- "Cedi" = GHS currency
- "Naira" = NGN currency
- "Gombo" = profit (slang)
- "Dettes" = debts
- "Vente" = sale
- "Dépense" = expense

COMPOUND TRANSACTIONS: When a user describes multiple actions in one sentence, call multiple tools in sequence.
Example: "I sold 2 bags of rice to Moussa but he only paid half (7500)"
→ First call record_sale (amount: 15000, description: "2 bags of rice to Moussa")
→ Then call add_debt (debtorName: "Moussa", amount: 7500, dueDate: next week's date)

Example: "Vente 3 sacs riz 15000 à Kossi"
→ call record_sale (amount: 15000, description: "3 sacs de riz à Kossi", currency: "XOF")

Example: "Ajoute une dépense de 2000 pour transport"
→ call record_expense (amount: 2000, description: "transport", currency: "XOF")

Example: "Relance Moussa" or "Send reminder to Moussa"
→ First call list_debts to find Moussa's debt ID, then call send_debt_reminder

Example: "Pourquoi mes ventes ont baissé?" or "Why did my sales drop?"
→ call analyze_trends (periodType: "week" or "month") to get period comparison, then explain the results

TOOL USAGE: When you need data or want to perform an action, emit a tool call as a JSON line:
{"tool_call": {"name": "<tool_name>", "input": {<arguments>}}}

You may emit MULTIPLE tool calls in sequence — emit one, wait for the result, then emit the next if needed.
Do NOT emit tool calls in your final answer to the user.

Available tools:
${toolList}
${memorySection}
RESPONSE FORMAT: After getting tool results, give a clear, friendly answer. Use the user's currency and language.
For numbers, format with thousands separators (e.g. 45 000 XOF not 45000).
Keep responses short — merchants are busy. Use bullet points for lists.`;
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
    private readonly memoryRepo: BusinessMemoryRepository,
    @Optional() @Inject(MESSAGING_CHANNELS) private readonly messagingChannels?: IMessagingChannel[],
  ) {}

  private async getMemory(businessId: string): Promise<AgentMemory | null> {
    return this.memoryRepo.get(businessId);
  }

  async chat(input: AgentChatInput): Promise<AgentChatResponse> {
    const { sessionId: inputSessionId, message, businessId, userId, customerEmail, tier, scope, channelUserId, channelName } = input;
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

    const memory = await this.getMemory(businessId);
    const systemPrompt = buildSystemPrompt(toolList, memory);
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

    if (channelUserId && channelName && finalMessage) {
      const ch = this.messagingChannels?.find(c => c.channelName === channelName);
      if (ch) {
        await ch.send({ channelUserId, text: finalMessage }).catch((err: unknown) => {
          this.logger.warn(`Failed to deliver message via ${channelName}: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }

    return { message: finalMessage, sessionId, toolsUsed };
  }
}
