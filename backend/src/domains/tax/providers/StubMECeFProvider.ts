import type {
  IMECeFProvider,
  MECeFInvoicePayload,
  MECeFRegistrationResult,
  MECeFConfirmResult,
} from '../interfaces/IMECeFProvider';

/**
 * Stub MECeF provider for Benin (BJ).
 * Simulates the DGI e-mecef.impots.bj API including the 120-second validation window.
 * Used when MECEF_BENIN_JWT is not configured.
 */
export class StubMECeFProvider implements IMECeFProvider {
  /** Maps token → expiry timestamp (ms) for window enforcement */
  private readonly pendingTokens = new Map<string, number>();

  getSupportedCountries(): string[] {
    return ['BJ'];
  }

  async registerInvoice(payload: MECeFInvoicePayload): Promise<MECeFRegistrationResult> {
    const token = `MECEF-STUB-${payload.ifu}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const expiresAt = new Date(Date.now() + 120_000).toISOString();

    this.pendingTokens.set(token, Date.now() + 120_000);
    setTimeout(() => this.pendingTokens.delete(token), 125_000);

    const totalTtc = payload.items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    return {
      token,
      expires_at: expiresAt,
      status: 'pending',
      totals: {
        ta: 0,
        tb: 18,
        taa: 0,
        tab: Math.round(totalTtc / 1.18),
        hab: Math.round(totalTtc / 1.18),
        vab: Math.round(totalTtc - totalTtc / 1.18),
        aib: 0,
        ts: 0,
        total: Math.round(totalTtc),
      },
    };
  }

  async confirmInvoice(
    token: string,
    decision: 'confirm' | 'cancel'
  ): Promise<MECeFConfirmResult | null> {
    const expiry = this.pendingTokens.get(token);

    if (!expiry || Date.now() > expiry) {
      return null;
    }

    this.pendingTokens.delete(token);

    if (decision === 'cancel') {
      return null;
    }

    const now = new Date();
    const nim = `STUB${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;
    const code = token.slice(-8).toUpperCase();
    const codeMECeFDGI = `STUB-${code.slice(0, 4)}-${code.slice(4)}-0000-0000`;
    const dateTime = now.toLocaleDateString('fr-FR') + ' ' + now.toLocaleTimeString('fr-FR');
    const qrCode = `F;${nim};${codeMECeFDGI.replace(/-/g, '')};${Date.now()}`;

    return {
      qr_code: qrCode,
      codeMECeFDGI,
      nim,
      counters: '1/1 FV',
      dateTime,
    };
  }
}
