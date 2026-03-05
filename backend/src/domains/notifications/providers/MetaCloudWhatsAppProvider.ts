import type { IWhatsAppProvider } from '../IWhatsAppProvider';

const META_GRAPH_BASE = 'https://graph.facebook.com/v21.0';

/**
 * Meta WhatsApp Business Cloud API provider.
 * Uses REST API (no SDK). Requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID.
 *
 * Note: Free-form text messages work within the 24-hour messaging window after a user
 * initiates contact. Outside that window, use approved templates (see Meta Business
 * Manager). Set WHATSAPP_TEMPLATE_NAME for template fallback if needed.
 */
export class MetaCloudWhatsAppProvider implements IWhatsAppProvider {
  constructor(
    private readonly accessToken: string,
    private readonly phoneNumberId: string,
  ) {
    if (!accessToken || !phoneNumberId) {
      throw new Error(
        'MetaCloudWhatsAppProvider requires WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID',
      );
    }
  }

  /** Normalize phone to E.164 digits only (no +). Meta API expects digits. */
  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (!digits.length) {
      throw new Error(`Invalid phone number: ${phone}`);
    }
    // If no country code, assume Nigeria (+234) for West Africa - caller should pass full E.164
    if (digits.length <= 10 && digits.startsWith('0')) {
      return '234' + digits.slice(1);
    }
    if (digits.length <= 10) {
      return '234' + digits;
    }
    return digits;
  }

  private async postMessages(body: object): Promise<{ messageId?: string }> {
    const url = `${META_GRAPH_BASE}/${this.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message: string; code?: number };
    };

    if (!res.ok) {
      const errMsg = data?.error?.message ?? `HTTP ${res.status}`;
      throw new Error(`Meta WhatsApp API error: ${errMsg}`);
    }

    return {
      messageId: data?.messages?.[0]?.id,
    };
  }

  async send(
    phone: string,
    message: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const to = this.normalizePhone(phone);
      const { messageId } = await this.postMessages({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: message,
        },
      });
      return { success: true, messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MetaCloudWhatsAppProvider] send failed:', msg);
      return { success: false };
    }
  }

  async sendMedia(
    phone: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string }> {
    try {
      const to = this.normalizePhone(phone);
      const document: { link: string; caption?: string } = { link: mediaUrl };
      if (caption) document.caption = caption;

      const { messageId } = await this.postMessages({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document,
      });
      return { success: true, messageId };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[MetaCloudWhatsAppProvider] sendMedia failed:', msg);
      return { success: false };
    }
  }
}
