export interface ISmsProvider {
  send(phone: string, message: string): Promise<{ success: boolean; messageId?: string }>;
}
