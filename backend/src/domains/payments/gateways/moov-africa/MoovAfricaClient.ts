/**
 * Moov Africa Merchant API Client — TypeScript port of v1p3r75/moov-money-api-php-sdk
 * SOAP API for Moov Money (Benin, Togo, Niger, etc.). Requires merchant credentials from Moov Africa.
 *
 * @see https://github.com/v1p3r75/moov-money-api-php-sdk
 * @see https://www.moov-africa.bj/devenir-marchand/
 */

import * as crypto from 'crypto';

const API_NAMESPACE = 'http://api.merchant.tlc.com/';
const SOAP_ENVELOPE_NS = 'http://schemas.xmlsoap.org/soap/envelope/';

const DEFAULT_ENCRYPTION_KEY = 'tlc12345tlc12345tlc12345tlc12345';
const SANDBOX_BASE_URL = 'https://testapimarchand2.moov-africa.bj:2010/com.tlc.merchant.api/UssdPush';
const PRODUCTION_BASE_URL = 'https://apimarchand.moov-africa.bj/com.tlc.merchant.api/UssdPush';

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="${SOAP_ENVELOPE_NS}" xmlns:api="${API_NAMESPACE}">
  <soapenv:Header/>
  <soapenv:Body>
    ${body}
  </soapenv:Body>
</soapenv:Envelope>`;
}

export interface MoovAfricaConfig {
  username: string;
  password: string;
  baseUrl?: string;
  encryptionKey?: string;
  useSandbox?: boolean;
  requestTimeout?: number;
}

export interface MoovAfricaResponse {
  statusCode: number;
  referenceId?: string;
  description?: string;
  transactionData?: Record<string, unknown>;
  isSuccess: boolean;
  isPending: boolean;
  raw?: Record<string, unknown>;
}

function parseSoapResponse(body: string): MoovAfricaResponse {
  try {
    // Extract ns2:return or similar from SOAP Body
    const statusMatch = body.match(/<statuscode>(\d+)<\/statuscode>/i);
    const refMatch = body.match(/<referenceid>([^<]*)<\/referenceid>/i);
    const descMatch = body.match(/<description>([^<]*)<\/description>/i);
    const transidMatch = body.match(/<transid>([^<]*)<\/transid>/i);

    const statusCode = statusMatch ? parseInt(statusMatch[1], 10) : -1;
    const referenceId = refMatch?.[1] ?? transidMatch?.[1];
    const description = descMatch?.[1];

    return {
      statusCode,
      referenceId,
      description,
      isSuccess: statusCode === 0,
      isPending: statusCode === 100,
    };
  } catch {
    return { statusCode: -1, isSuccess: false, isPending: false };
  }
}

function parseSoapFault(body: string): string {
  const faultMatch = body.match(/<faultstring>([^<]*)<\/faultstring>/i);
  const faultCode = body.match(/<faultcode>([^<]*)<\/faultcode>/i);
  const code = faultCode?.[1] ?? 'Error';
  const msg = faultMatch?.[1] ?? 'An error has occurred';
  return `[${code}]: ${msg}`;
}

export class MoovAfricaClient {
  private readonly username: string;
  private readonly password: string;
  private readonly baseUrl: string;
  private readonly encryptionKey: string;
  private readonly timeout: number;

  constructor(config: MoovAfricaConfig) {
    this.username = config.username;
    this.password = config.password;
    this.baseUrl =
      config.baseUrl ??
      (config.useSandbox !== false ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL);
    this.encryptionKey = config.encryptionKey ?? DEFAULT_ENCRYPTION_KEY;
    this.timeout = config.requestTimeout ?? 60;
  }

  private generateToken(): string {
    const plaintext = `0:${this.username}:${this.password}`;
    const key = Buffer.from(this.encryptionKey, 'utf8');
    if (key.length !== 16 && key.length !== 24 && key.length !== 32) {
      throw new Error("Encryption key must be 16, 24, or 32 bytes (128, 192, or 256 bits)");
    }
    const key32 = Buffer.alloc(32);
    key.copy(key32, 0, 0, Math.min(key.length, 32));
    const iv = Buffer.alloc(16, 0);
    const cipher = crypto.createCipheriv('aes-256-cbc', key32, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return encrypted.toString('base64');
  }

  private async request(soapBody: string): Promise<MoovAfricaResponse> {
    const xml = buildEnvelope(soapBody);
    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
      },
      body: xml,
      signal: AbortSignal.timeout(this.timeout * 1000),
    });

    const text = await res.text();

    if (res.status >= 500) {
      const fault = parseSoapFault(text);
      throw new Error(fault || `HTTP ${res.status}`);
    }

    const parsed = parseSoapResponse(text);
    if (res.status >= 400 && !parsed.description) {
      parsed.description = parseSoapFault(text);
    }
    return parsed;
  }

  /** Push transaction — request payment from customer (immediate). */
  async pushTransaction(
    phone: string,
    amount: number,
    message: string,
    data1 = '',
    data2 = '',
    fee = 0,
  ): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:Push>
  <token>${escapeXml(token)}</token>
  <msisdn>${escapeXml(phone)}</msisdn>
  <message>${escapeXml(message)}</message>
  <amount>${amount}</amount>
  <externaldata1>${escapeXml(data1)}</externaldata1>
  <externaldata2>${escapeXml(data2)}</externaldata2>
  <fee>${fee}</fee>
</api:Push>`;
    return this.request(body);
  }

  /** Push with pending — customer confirms via USSD. Use for invoice payments. */
  async pushWithPendingTransaction(
    phone: string,
    amount: number,
    message: string,
    data1 = '',
    data2 = '',
    fee = 0,
  ): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:PushWithPending>
  <token>${escapeXml(token)}</token>
  <msisdn>${escapeXml(phone)}</msisdn>
  <message>${escapeXml(message)}</message>
  <amount>${amount}</amount>
  <externaldata1>${escapeXml(data1)}</externaldata1>
  <externaldata2>${escapeXml(data2)}</externaldata2>
  <fee>${fee}</fee>
</api:PushWithPending>`;
    return this.request(body);
  }

  /** Check transaction status by reference ID. */
  async getTransactionStatus(referenceId: string): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:getTransactionStatus>
  <token>${escapeXml(token)}</token>
  <request>
    <transid>${escapeXml(referenceId)}</transid>
  </request>
</api:getTransactionStatus>`;
    return this.request(body);
  }

  /** Transfer Flooz from merchant wallet to destination (disbursement). */
  async transferFlooz(
    destination: string,
    amount: number,
    referenceId: string,
    walletId = '0',
    data = '',
  ): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:transferFlooz>
  <token>${escapeXml(token)}</token>
  <request>
    <destination>${escapeXml(destination)}</destination>
    <amount>${amount}</amount>
    <referenceid>${escapeXml(referenceId)}</referenceid>
    <walletid>${escapeXml(walletId)}</walletid>
    <extendeddata>${escapeXml(data)}</extendeddata>
  </request>
</api:transferFlooz>`;
    return this.request(body);
  }

  /** Get subscriber balance. */
  async getBalance(phone: string): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:getBalance>
  <token>${escapeXml(token)}</token>
  <request>
    <msisdn>${escapeXml(phone)}</msisdn>
  </request>
</api:getBalance>`;
    return this.request(body);
  }

  /** Get subscriber KYC status. */
  async getMobileStatus(phone: string): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:getMobileAccountStatus>
  <token>${escapeXml(token)}</token>
  <request>
    <msisdn>${escapeXml(phone)}</msisdn>
  </request>
</api:getMobileAccountStatus>`;
    return this.request(body);
  }

  /** Cash-in to subscriber. */
  async cashIn(
    destination: string,
    amount: number,
    referenceId: string,
    remarks = '',
  ): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:cashintrans>
  <token>${escapeXml(token)}</token>
  <request>
    <amount>${amount}</amount>
    <destination>${escapeXml(destination)}</destination>
    <referenceid>${escapeXml(referenceId)}</referenceid>
    <remarks>${escapeXml(remarks)}</remarks>
  </request>
</api:cashintrans>`;
    return this.request(body);
  }

  /** Airtime top-up. */
  async airTime(
    destination: string,
    amount: number,
    referenceId: string,
    remarks = '',
  ): Promise<MoovAfricaResponse> {
    const token = this.generateToken();
    const body = `<api:airtimetrans>
  <token>${escapeXml(token)}</token>
  <request>
    <amount>${amount}</amount>
    <destination>${escapeXml(destination)}</destination>
    <referenceid>${escapeXml(referenceId)}</referenceid>
    <remarks>${escapeXml(remarks)}</remarks>
  </request>
</api:airtimetrans>`;
    return this.request(body);
  }
}
