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
 *
 * API spec: e-MCF API v1.0 (DGI Bénin)
 * Sandbox: https://developper.impots.bj/sygmef-emcf/api
 * Production: https://sygmef.impots.bj/emcf/api
 *
 * Flow:
 *  1. POST /api/invoice  → DGI returns uid + computed totals (2-min window)
 *  2. PUT  /api/invoice/{uid}/confirm → DGI returns qrCode + codeMECeFDGI + nim
 *
 * Requires MECEF_BENIN_JWT env var (JWT from developper.impots.bj).
 * Falls back to StubMECeFProvider when JWT is unset.
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

    const url = `${this.apiBase()}/invoice`;
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

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const errCode = data.errorCode ?? response.status;
      const errDesc = data.errorDesc ?? response.statusText;
      throw new Error(`e-MECeF registerInvoice failed [${errCode}]: ${errDesc}`);
    }

    const uid = data.uid as string | undefined;
    if (!uid) {
      // DGI returns errorCode/errorDesc even on HTTP 200 for business errors
      const errCode = data.errorCode ?? 'unknown';
      const errDesc = data.errorDesc ?? JSON.stringify(data);
      throw new Error(`e-MECeF registerInvoice error [${errCode}]: ${errDesc}`);
    }

    const expiresAt = new Date(Date.now() + 120_000).toISOString();
    return {
      token: uid,
      expires_at: expiresAt,
      status: 'pending',
      totals: {
        ta: Number(data.ta ?? 0),
        tb: Number(data.tb ?? 0),
        taa: Number(data.taa ?? 0),
        tab: Number(data.tab ?? 0),
        hab: Number(data.hab ?? 0),
        vab: Number(data.vab ?? 0),
        aib: Number(data.aib ?? 0),
        ts: Number(data.ts ?? 0),
        total: Number(data.total ?? 0),
      },
    };
  }

  async confirmInvoice(
    token: string,
    decision: 'confirm' | 'cancel'
  ): Promise<MECeFConfirmResult | null> {
    if (!this.jwt) {
      throw new Error('MECEF_BENIN_JWT is not configured.');
    }

    const url = `${this.apiBase()}/invoice/${token}/${decision}`;

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.jwt}`,
        Accept: 'application/json',
      },
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (!response.ok) {
      const errCode = data.errorCode ?? response.status;
      const errDesc = data.errorDesc ?? response.statusText;
      throw new Error(`e-MECeF confirmInvoice failed [${errCode}]: ${errDesc}`);
    }

    if (decision === 'cancel') {
      return null;
    }

    const qrCode = data.qrCode as string | undefined;
    const codeMECeFDGI = data.codeMECeFDGI as string | undefined;
    const nim = data.nim as string | undefined;

    if (!qrCode && !codeMECeFDGI) {
      const errCode = data.errorCode ?? 'unknown';
      const errDesc = data.errorDesc ?? JSON.stringify(data);
      throw new Error(`e-MECeF confirmInvoice returned no security elements [${errCode}]: ${errDesc}`);
    }

    return {
      qr_code: qrCode ?? '',
      codeMECeFDGI: codeMECeFDGI ?? '',
      nim: nim ?? '',
      counters: (data.counters as string) ?? '',
      dateTime: (data.dateTime as string) ?? new Date().toLocaleString('fr-FR'),
    };
  }

  /** Base API URL depending on environment. */
  private apiBase(): string {
    return this.isProd
      ? `${this.baseUrl}/emcf/api`
      : `${this.baseUrl}/sygmef-emcf/api`;
  }

  /** Map our internal payload to the DGI InvoiceRequestDataDto. */
  private mapToEmecefPayload(payload: MECeFInvoicePayload): Record<string, unknown> {
    const items = payload.items.map((item) => {
      const mapped: Record<string, unknown> = {
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        taxGroup: item.taxGroup,
      };
      if (item.code !== undefined) mapped.code = item.code;
      if (item.taxSpecific !== undefined) mapped.taxSpecific = item.taxSpecific;
      if (item.originalPrice !== undefined) mapped.originalPrice = item.originalPrice;
      if (item.priceModification !== undefined) mapped.priceModification = item.priceModification;
      return mapped;
    });

    const body: Record<string, unknown> = {
      ifu: payload.ifu,
      type: payload.type_facture,
      items,
      operator: {
        ...(payload.operator.id !== undefined && { id: payload.operator.id }),
        name: payload.operator.name,
      },
    };

    if (payload.client) {
      const c: Record<string, unknown> = {};
      if (payload.client.ifu) c.ifu = payload.client.ifu;
      if (payload.client.name) c.name = payload.client.name;
      if (payload.client.contact) c.contact = payload.client.contact;
      if (payload.client.address) c.address = payload.client.address;
      if (Object.keys(c).length > 0) body.client = c;
    }

    if (payload.payment && payload.payment.length > 0) {
      body.payment = payload.payment.map((p) => ({ name: p.name, amount: p.amount }));
    }

    if (payload.aib) {
      body.aib = payload.aib;
    }

    // Required for FA/EA credit notes
    if (payload.reference) {
      body.reference = payload.reference;
    }

    return body;
  }
}
