import type { IWhatsAppProvider } from '../IWhatsAppProvider';

/**
 * No-op WhatsApp provider for when WHATSAPP_PROVIDER is not configured.
 * Logs instead of sending; use for development.
 */
export class MockWhatsAppProvider implements IWhatsAppProvider {
  async send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    console.log('[MockWhatsAppProvider] Would send to', phone, ':', message.slice(0, 50) + '...');
    return { success: true, messageId: `mock_${Date.now()}` };
  }

  async sendMedia(
    phone: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    console.log('[MockWhatsAppProvider] Would send media to', phone, ':', mediaUrl.slice(0, 60) + '...');
    if (caption) console.log('[MockWhatsAppProvider] Caption:', caption.slice(0, 80));
    return { success: true, messageId: `mock_${Date.now()}` };
  }
}
