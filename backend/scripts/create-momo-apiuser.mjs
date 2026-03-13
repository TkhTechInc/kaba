#!/usr/bin/env node
/**
 * Create MTN MoMo API user and API key for Sandbox.
 *
 * Prerequisites:
 *   1. Sign up at https://momodeveloper.mtn.com/signup
 *   2. Subscribe to Collections (and optionally Disbursements)
 *   3. Copy your Subscription Key from your profile
 *
 * Usage:
 *   MOMO_SUBSCRIPTION_KEY=your-key node scripts/create-momo-apiuser.mjs
 *
 * For both Collections and Disbursements:
 *   MOMO_SUBSCRIPTION_KEY=collections-key \
 *   MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=disbursements-key \
 *   node scripts/create-momo-apiuser.mjs
 *
 * Output: Credentials to add to your .env file.
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const BASE_URL = process.env.MOMO_BASE_URL || 'https://sandbox.momodeveloper.mtn.com';
const CALLBACK_HOST = process.env.MOMO_CALLBACK_HOST || 'webhook.site';

async function createApiUser(subscriptionKey, productLabel) {
  const apiUserId = crypto.randomUUID();

  const res = await fetch(`${BASE_URL}/v1_0/apiuser`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Reference-Id': apiUserId,
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
    body: JSON.stringify({ providerCallbackHost: CALLBACK_HOST }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${productLabel} API user creation failed (${res.status}): ${text}`);
  }

  return apiUserId;
}

async function createApiKey(apiUserId, subscriptionKey, productLabel) {
  const res = await fetch(`${BASE_URL}/v1_0/apiuser/${apiUserId}/apikey`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscriptionKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${productLabel} API key creation failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.apiKey;
}

async function main() {
  const collectionKey = process.env.MOMO_SUBSCRIPTION_KEY?.trim();
  const disbursementKey = process.env.MOMO_DISBURSEMENT_SUBSCRIPTION_KEY?.trim();

  console.log(`Base URL: ${BASE_URL} ${BASE_URL.includes('sandbox') ? '(sandbox)' : '(production)'}`);
  console.log('');

  if (!collectionKey && !disbursementKey) {
    console.error('Usage: MOMO_SUBSCRIPTION_KEY=<key> [MOMO_DISBURSEMENT_SUBSCRIPTION_KEY=<key>] node scripts/create-momo-apiuser.mjs');
    console.error('');
    console.error('Get your Subscription Key from https://momodeveloper.mtn.com after subscribing to Collections or Disbursements.');
    process.exit(1);
  }

  const lines = [];

  if (collectionKey) {
    try {
      const apiUserId = await createApiUser(collectionKey, 'Collections');
      const apiKey = await createApiKey(apiUserId, collectionKey, 'Collections');
      console.log('Collections API user created.');
      lines.push(`MOMO_API_USER=${apiUserId}`);
      lines.push(`MOMO_API_KEY=${apiKey}`);
    } catch (err) {
      console.error('Collections:', err.message);
      process.exit(1);
    }
  }

  if (disbursementKey) {
    try {
      const apiUserId = await createApiUser(disbursementKey, 'Disbursement');
      const apiKey = await createApiKey(apiUserId, disbursementKey, 'Disbursement');
      console.log('Disbursement API user created.');
      lines.push(`MOMO_DISBURSEMENT_API_USER=${apiUserId}`);
      lines.push(`MOMO_DISBURSEMENT_API_KEY=${apiKey}`);
    } catch (err) {
      console.error('Disbursement:', err.message);
      console.error('(Collections credentials above are still valid. Subscribe to Disbursements and use that product\'s key.)');
      // Don't exit - user still gets Collections credentials
    }
  }

  console.log('');
  console.log('Add these to your .env file:');
  console.log('');
  lines.forEach((line) => console.log(line));
  console.log('');
  console.log('Optional: MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com');
  console.log('Optional: MOMO_TARGET_ENV=sandbox');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
