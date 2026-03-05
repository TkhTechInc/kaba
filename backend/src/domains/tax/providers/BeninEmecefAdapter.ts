import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IMECeFProvider,
  MECeFInvoicePayload,
  MECeFRegistrationResult,
  MECeFConfirmResult,
} from '../interfaces/IMECeFProvider';

/**
 * Real e-MECeF adapter for Benin DGI.
 * Calls the actual e-MECeF API at developper.impots.bj (test) or sygmef.impots.bj (prod).
 *
 * Flow:
 *  1. POST /invoice/ → DGI returns uid; 2-minute window starts
 *  2. PUT /invoice/{uid}/confirm → DGI returns QR + fiscal serial
 *
 * Requires MECEF_BENIN_JWT env var. Use StubMECeFProvider when JWT is not configured.
 */
@Injectable()
export class BeninEmecefAdapter implements IMECeFProvider {
  private readonly baseUrl: string;
  private readonly jwt: string;
  private readonly isProd: boolean;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('fiscal.mecefBeninBaseUrl') ?? 'https://developper.impots.bj';
    this.jwt = this.config.get<string>('fiscal.mecefBeninJwt') ?? '';
    this.isProd = this.baseUrl.includes('sygmef.impots.bj');
  }

  getSupportedCountries(): string[] {
    return ['BJ'];
  }

  async registerInvoice(payload: MECeFInvoicePayload): Promise<MECeFRegistrationResult> {
    if (!this.jwt) {
      throw new Error('MECEF_BENIN_JWT is not configured. Set env var or use StubMECeFProvider.');
    }

    const pathPrefix = this.isProd ? '/emcf/api' : '/sygmef-emcf/api';
    const url = `${this.baseUrl}${pathPrefix}/invoice/`;

    const body = this.mapToEmecefPayload(payload);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`e-MECeF registerInvoice failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    const uid = data.uid as string;
    if (!uid) {
      throw new Error(`e-MECeF response missing uid: ${JSON.stringify(data)}`);
    }

    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    return {
      token: uid,
      expires_at: expiresAt,
      status: 'pending',
    };
  }

  async confirmInvoice(
    token: string,
    decision: 'confirm' | 'reject'
  ): Promise<MECeFConfirmResult | null> {
    if (!this.jwt) {
      throw new Error('MECEF_BENIN_JWT is not configured.');
    }

    const action = decision === 'confirm' ? 'confirm' : 'cancel';
    const pathPrefix = this.isProd ? '/emcf/api' : '/sygmef-emcf/api';
    const url = `${this.baseUrl}${pathPrefix}/invoice/${token}/${action}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`e-MECeF confirmInvoice failed: ${response.status} ${response.statusText} - ${text}`);
    }

    if (decision === 'reject') {
      return null;
    }

    const data = (await response.json()) as Record<string, unknown>;
    const qrCode = (data.qrCode ?? data.qr_code ?? data.nim) as string | undefined;
    const nimFacture = (data.nim ?? data.nimFacture ?? data.fiscalNumber ?? token) as string;
    const certifiedAt = new Date().toISOString();

    return {
      qr_code: qrCode ?? `https://e-mecef.impots.bj/verify?nim=${nimFacture}`,
      nim_facture: nimFacture,
      signature: (data.signature as string) ?? `SIG-${nimFacture}`,
      certified_at: (data.certifiedAt as string) ?? certifiedAt,
    };
  }

  private mapToEmecefPayload(payload: MECeFInvoicePayload): Record<string, unknown> {
    const items = payload.items.map((item) => ({
      name: item.nom,
      price: item.prix_unitaire_ht,
      quantity: item.quantite,
      taxGroup: 'A',
    }));

    const body: Record<string, unknown> = {
      ifu: payload.ifu,
      type: payload.type_facture,
      client: {
        name: 'Client',
        ...(payload.client_ifu && { ifu: payload.client_ifu }),
      },
      operator: { id: 'OP1', name: 'System' },
      items,
      payment: [{ name: 'ESPECES', amount: payload.montant_ttc }],
    };

    if (payload.reference) {
      body.reference = payload.reference;
    }

    return body;
  }
}
