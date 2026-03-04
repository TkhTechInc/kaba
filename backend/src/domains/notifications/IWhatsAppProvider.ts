/**
 * Interface for sending WhatsApp messages (receipts, debt reminders).
 * Implementations: TwilioWhatsApp, AfricasTalkingWhatsApp, MetaCloudWhatsApp.
 * Switch via WHATSAPP_PROVIDER env.
 */
export interface IWhatsAppProvider {
  /** Send a WhatsApp message to the given phone number. */
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }>;

  /** Send a media message (e.g. PDF receipt). Optional; some providers may not support. */
  sendMedia?(
    phone: string,
    mediaUrl: string,
    caption?: string,
  ): Promise<{ success: boolean; messageId?: string }>;
}
