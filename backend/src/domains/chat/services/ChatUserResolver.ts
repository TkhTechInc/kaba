import { Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@/nest/modules/auth/repositories/UserRepository';
import { AccessService } from '@/domains/access/AccessService';
import type { ChannelName } from '../interfaces/IMessagingChannel';

export interface ResolvedChatUser {
  userId: string;
  businessId: string;
}

@Injectable()
export class ChatUserResolver {
  private readonly logger = new Logger(ChatUserResolver.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Resolve a WhatsApp phone number (E.164) to a Kaba userId + businessId.
   * Reuses the same pattern as UssdService.resolveBusinessId().
   */
  async resolveByPhone(phone: string): Promise<ResolvedChatUser | null> {
    const user = await this.userRepo.getByPhone(phone);
    if (!user) return null;

    const businesses = await this.accessService.listBusinessesForUser(user.id);
    if (!businesses.length) return null;

    return { userId: user.id, businessId: businesses[0].businessId };
  }

  /**
   * Resolve a Kaba email address to a userId + businessId.
   * Used by the LINK <email> registration command.
   */
  async resolveByEmail(email: string): Promise<ResolvedChatUser | null> {
    const user = await this.userRepo.getByEmail(email.toLowerCase().trim());
    if (!user) return null;

    const businesses = await this.accessService.listBusinessesForUser(user.id);
    if (!businesses.length) return null;

    return { userId: user.id, businessId: businesses[0].businessId };
  }

  /**
   * Resolve a channelUserId to a Kaba account.
   * - WhatsApp: channelUserId is an E.164 phone number — direct lookup via UserRepository.
   * - Telegram: channelUserId is a numeric chat_id — no phone available, must use LINK flow.
   */
  async resolveByChannelUserId(
    channelUserId: string,
    channel: ChannelName,
  ): Promise<ResolvedChatUser | null> {
    if (channel === 'whatsapp') {
      return this.resolveByPhone(channelUserId);
    }
    // Telegram chat_ids are not phone numbers — user must explicitly LINK their email.
    this.logger.debug(`Telegram session ${channelUserId} — no auto-resolve, awaiting LINK command`);
    return null;
  }
}
