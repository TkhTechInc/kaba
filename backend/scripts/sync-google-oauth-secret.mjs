#!/usr/bin/env node
/**
 * Sync Google OAuth credentials from .env to AWS Secrets Manager.
 * Usage: node scripts/sync-google-oauth-secret.mjs [environment]
 * Default environment: dev
 * Requires: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SecretsManagerClient, CreateSecretCommand, PutSecretValueCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const env = process.argv[2] || 'dev';
const secretName = `kaba/${env}/google-oauth`;
const region = env === 'prod' ? 'af-south-1' : 'ca-central-1';

const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim();

if (!clientId || !clientSecret) {
  console.error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in backend/.env');
  process.exit(1);
}

const client = new SecretsManagerClient({ region });

async function run() {
  const secretString = JSON.stringify({ client_id: clientId, client_secret: clientSecret });
  try {
    await client.send(new DescribeSecretCommand({ SecretId: secretName }));
    await client.send(new PutSecretValueCommand({
      SecretId: secretName,
      SecretString: secretString,
    }));
    console.log(`Updated secret ${secretName} in ${region}`);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      await client.send(new CreateSecretCommand({
        Name: secretName,
        SecretString: secretString,
      }));
      console.log(`Created secret ${secretName} in ${region}`);
    } else {
      throw err;
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
