#!/usr/bin/env node
/**
 * MECeF sandbox connectivity test.
 * Calls the Benin DGI e-MECeF sandbox directly (no NestJS).
 *
 * Usage:
 *   MECEF_BENIN_JWT=your_jwt node scripts/mecef-sandbox-test.mjs
 *   MECEF_BENIN_JWT=your_jwt npm run mecef:sandbox-test
 *
 * Requires: MECEF_BENIN_JWT from developper.impots.bj
 */

const BASE_URL = process.env.MECEF_BENIN_BASE_URL || 'https://developper.impots.bj';
const JWT = process.env.MECEF_BENIN_JWT || '';
const TEST_IFU = process.env.MECEF_TEST_IFU || '3202200000001';
const API_PREFIX = '/sygmef-emcf/api';

if (!JWT) {
  console.error('MECEF_BENIN_JWT is required. Get it from https://developper.impots.bj');
  process.exit(1);
}

async function fetchApi(method, path, body = null) {
  const url = `${BASE_URL}${API_PREFIX}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${JWT}`,
      Accept: 'application/json',
      ...(body && { 'Content-Type': 'application/json' }),
    },
    ...(body && { body: JSON.stringify(body) }),
  };
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log('MECeF sandbox test');
  console.log('Base URL:', BASE_URL);
  console.log('');

  try {
    // 1. Check API status
    console.log('1. GET /info/status');
    const status = await fetchApi('GET', '/info/status');
    console.log('   OK:', JSON.stringify(status, null, 2).split('\n').join('\n   '));
    console.log('');

    // 2. Register invoice
    // Use taxGroup 'B' (18% TVA — standard rate).
    // price is TTC unit price (integer, XOF). DGI computes HT/TVA.
    const itemPrice = 10000;
    const quantity = 1;
    const totalTtc = itemPrice * quantity;
    const payload = {
      ifu: TEST_IFU,
      type: 'FV',
      operator: { name: 'Kaba Test' },
      items: [
        { name: 'Test article', price: itemPrice, quantity, taxGroup: 'B' },
      ],
      payment: [{ name: 'ESPECES', amount: totalTtc }],
    };
    console.log('2. POST /invoice');
    console.log('   Payload:', JSON.stringify(payload, null, 2).replace(/\n/g, '\n   '));
    const reg = await fetchApi('POST', '/invoice', payload);
    const uid = reg.uid;
    if (!uid) {
      throw new Error(`Response missing uid: ${JSON.stringify(reg)}`);
    }
    console.log('   OK → uid:', uid);
    console.log('');

    // 3. Confirm within 120s
    console.log('3. PUT /invoice/' + uid + '/confirm');
    await new Promise((r) => setTimeout(r, 1500));
    const confirm = await fetchApi('PUT', `/invoice/${uid}/confirm`);
    console.log('   OK:', JSON.stringify(confirm, null, 2).split('\n').join('\n   '));
    console.log('');
    console.log('MECeF sandbox test passed.');
    if (confirm.qrCode) console.log('QR Code:', confirm.qrCode);
    if (confirm.codeMECeFDGI) console.log('codeMECeFDGI:', confirm.codeMECeFDGI);
    if (confirm.nim) console.log('NIM:', confirm.nim);
    if (confirm.counters) console.log('Counters:', confirm.counters);
    if (confirm.dateTime) console.log('DateTime:', confirm.dateTime);
  } catch (e) {
    console.error('Failed:', e.message);
    process.exit(1);
  }
}

main();
