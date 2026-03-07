import { Inject, Injectable, Logger } from '@nestjs/common';
import { LedgerService } from '../../ledger/services/LedgerService';
import { InvoiceService } from '../../invoicing/services/InvoiceService';
import { DebtService } from '../../debts/services/DebtService';
import { BusinessTrustScoreService } from '../../trust/BusinessTrustScoreService';
import { VoiceToTransactionService } from '../../ai/VoiceToTransactionService';
import { ReportService } from '../../reports/ReportService';
import type { IMessagingChannel, IncomingMessage, OutgoingMessage } from '../interfaces/IMessagingChannel';
import type { IIntentParser, ParsedIntent } from '../interfaces/IIntentParser';
import type { IConversationStore, ChatSession } from '../interfaces/IConversationStore';

export const CONVERSATION_STORE = 'IConversationStore';
export const INTENT_PARSER = 'IIntentParser';
export const MESSAGING_CHANNELS = 'MESSAGING_CHANNELS';

@Injectable()
export class ChatOrchestrator {
  private readonly logger = new Logger(ChatOrchestrator.name);

  constructor(
    @Inject(CONVERSATION_STORE) private readonly store: IConversationStore,
    @Inject(INTENT_PARSER) private readonly intentParser: IIntentParser,
    @Inject(MESSAGING_CHANNELS) private readonly channels: IMessagingChannel[],
    private readonly ledgerService: LedgerService,
    private readonly invoiceService: InvoiceService,
    private readonly debtService: DebtService,
    private readonly trustService: BusinessTrustScoreService,
    private readonly voiceService: VoiceToTransactionService,
    private readonly reportService: ReportService,
  ) {}

  async handle(incoming: IncomingMessage): Promise<void> {
    const sessionId = `${incoming.channelUserId}:${incoming.channel}`;
    const channel = this.channels.find(c => c.channelName === incoming.channel);
    if (!channel) {
      this.logger.warn(`No channel handler for ${incoming.channel}`);
      return;
    }

    let session = await this.store.get(sessionId);
    if (!session) {
      // New session — in production, businessId is resolved from a channel-user registry.
      // Until that registration flow exists, channelUserId acts as a placeholder businessId.
      session = {
        id: sessionId,
        businessId: incoming.channelUserId,
        userId: incoming.channelUserId,
        channel: incoming.channel,
        channelUserId: incoming.channelUserId,
        history: [],
        updatedAt: new Date().toISOString(),
      };
    }

    const text = incoming.text ?? '';
    const contextLines = session.history.slice(-6).map(m => `${m.role}: ${m.text}`);
    const intent = await this.intentParser.parse(text, contextLines);
    this.logger.log(`Intent: ${intent.type} (${intent.confidence}) for session ${sessionId}`);

    let reply: string;
    try {
      reply = await this.handleIntent(intent, session);
    } catch (err) {
      this.logger.error('Intent handling failed', err);
      reply = 'Sorry, something went wrong. Please try again.';
    }

    // Persist history, keeping last 20 messages
    session.history.push({ role: 'user', text, ts: new Date().toISOString() });
    session.history.push({ role: 'bot', text: reply, ts: new Date().toISOString() });
    if (session.history.length > 20) session.history = session.history.slice(-20);
    session.updatedAt = new Date().toISOString();
    session.pendingIntent = undefined;
    await this.store.save(session);

    const outgoing: OutgoingMessage = { channelUserId: incoming.channelUserId, text: reply };
    await channel.send(outgoing);
  }

  private async handleIntent(intent: ParsedIntent, session: ChatSession): Promise<string> {
    const { businessId } = session;
    const e = intent.entities;

    switch (intent.type) {
      case 'check_balance': {
        const balance = await this.ledgerService.getBalance(businessId);
        return `Your balance: ${balance.currency} ${balance.balance.toLocaleString()}`;
      }

      case 'record_sale': {
        const result = await this.voiceService.processFromText(
          intent.rawText,
          businessId,
          e['currency'] as string | undefined,
        );
        if (result.success && result.entry) {
          return `Recorded sale: ${result.entry.description} — ${result.entry.amount.toLocaleString()}`;
        }
        return result.error
          ? `Could not record sale: ${result.error}`
          : `Could not record sale. Try: "I sold 3 bags of rice for 45,000 XOF"`;
      }

      case 'record_expense': {
        const result = await this.voiceService.processFromText(
          intent.rawText,
          businessId,
          e['currency'] as string | undefined,
        );
        if (result.success && result.entry) {
          return `Recorded expense: ${result.entry.description} — ${result.entry.amount.toLocaleString()}`;
        }
        return result.error
          ? `Could not record expense: ${result.error}`
          : `Could not record expense. Try: "I spent 10,000 XOF on transport"`;
      }

      case 'list_unpaid_invoices': {
        const invoices = await this.invoiceService.listUnpaid(businessId);
        if (!invoices.length) return 'No unpaid invoices.';
        const lines = invoices
          .slice(0, 5)
          .map(inv => `• #${inv.id.slice(-6)} — ${inv.currency} ${inv.amount.toLocaleString()} (due ${inv.dueDate})`);
        const suffix = invoices.length > 5 ? `\n…and ${invoices.length - 5} more.` : '';
        return `Unpaid invoices (${invoices.length} total):\n${lines.join('\n')}${suffix}`;
      }

      case 'list_debts': {
        const result = await this.debtService.list(businessId);
        if (!result.items.length) return 'No outstanding debts.';
        const lines = result.items
          .slice(0, 5)
          .map(d => `• ${d.debtorName} — ${d.currency} ${d.amount.toLocaleString()} (due ${d.dueDate})`);
        const suffix = result.items.length > 5 ? `\n…and ${result.items.length - 5} more.` : '';
        return `Outstanding debts (${result.total} total):\n${lines.join('\n')}${suffix}`;
      }

      case 'get_trust_score': {
        const score = await this.trustService.calculate(businessId);
        const tip =
          score.recommendation === 'excellent'
            ? 'Excellent standing — share your badge to attract buyers.'
            : 'Keep recording transactions consistently to improve your score.';
        return `Your Sika Trust Score: ${score.trustScore}/100 (${score.recommendation})\n${tip}`;
      }

      case 'get_report': {
        const today = new Date();
        const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
        const to = today.toISOString().slice(0, 10);
        const pl = await this.reportService.getPL(businessId, from, to);
        return (
          `This month (${pl.period.start} to ${pl.period.end}):\n` +
          `Revenue: ${pl.currency} ${pl.totalIncome.toLocaleString()}\n` +
          `Expenses: ${pl.currency} ${pl.totalExpenses.toLocaleString()}\n` +
          `Net: ${pl.currency} ${pl.netProfit.toLocaleString()}`
        );
      }

      // generate_invoice and send_invoice require a full conversation flow
      // (customer lookup, line-item collection) — stub response for now.
      case 'generate_invoice':
        return 'Invoice creation via chat is coming soon. Use the Kaba app to create invoices for now.';

      case 'send_invoice':
        return 'Invoice sending via chat is coming soon. Use the Kaba app to send invoices for now.';

      default:
        return (
          `I didn't understand that. Try:\n` +
          `• "Check my balance"\n` +
          `• "I sold [item] for [amount]"\n` +
          `• "I spent [amount] on [item]"\n` +
          `• "List unpaid invoices"\n` +
          `• "List my debts"\n` +
          `• "My trust score"\n` +
          `• "Monthly report"`
        );
    }
  }
}
