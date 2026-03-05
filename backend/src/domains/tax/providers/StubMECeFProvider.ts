import type {
  IMECeFProvider,
  MECeFInvoicePayload,
  MECeFRegistrationResult,
  MECeFConfirmResult,
} from '../interfaces/IMECeFProvider';

/**
 * Stub MECeF provider for Benin (BJ).
 * Simulates the DGI e-mecef.impots.bj API including the 120-second validation window.
 * Replace with RealMECeFProvider when production credentials are available.
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

    // Auto-clean expired tokens
    setTimeout(() => this.pendingTokens.delete(token), 125_000);

    return { token, expires_at: expiresAt, status: 'pending' };
  }

  async confirmInvoice(
    token: string,
    decision: 'confirm' | 'reject'
  ): Promise<MECeFConfirmResult | null> {
    const expiry = this.pendingTokens.get(token);

    if (!expiry || Date.now() > expiry) {
      return null;
    }

    this.pendingTokens.delete(token);

    if (decision === 'reject') {
      return null;
    }

    const certifiedAt = new Date().toISOString();
    const nimFacture = `BJ-FNE-${certifiedAt.slice(0, 10).replace(/-/g, '')}-${token.slice(-8)}`;

    return {
      qr_code: `https://e-mecef.impots.bj/verify?nim=${nimFacture}&t=${Date.now()}`,
      nim_facture: nimFacture,
      signature: `SIG-STUB-${Buffer.from(token).toString('base64').slice(0, 16)}`,
      certified_at: certifiedAt,
    };
  }
}
