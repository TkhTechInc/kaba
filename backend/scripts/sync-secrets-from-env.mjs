#!/usr/bin/env node
/**
 * Sync secrets from backend/.env to AWS Secrets Manager.
 * Usage: node scripts/sync-secrets-from-env.mjs [environment]
 * Default environment: dev
 *
 * Syncs: Google OAuth, OpenRouter API key
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SecretsManagerClient, CreateSecretCommand, PutSecretValueCommand, DescribeSecretCommand } from '@aws-sdk/client-secrets-manager';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const env = process.argv[2] || 'dev';
const region = env === 'prod' ? 'af-south-1' : 'ca-central-1';
const client = new SecretsManagerClient({ region });

async function upsertSecret(name, secretString) {
  try {
    await client.send(new DescribeSecretCommand({ SecretId: name }));
    await client.send(new PutSecretValueCommand({ SecretId: name, SecretString: secretString }));
    console.log(`Updated ${name}`);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      await client.send(new CreateSecretCommand({ Name: name, SecretString: secretString }));
      console.log(`Created ${name}`);
    } else {
      throw err;
    }
  }
}

async function run() {
  // Google OAuth
  const clientId = process.env['GOOGLE_CLIENT_ID']?.trim();
  const clientSecret = process.env['GOOGLE_CLIENT_SECRET']?.trim();
  if (clientId && clientSecret) {
    await upsertSecret(`kaba/${env}/google-oauth`, JSON.stringify({ client_id: clientId, client_secret: clientSecret }));
  } else {
    console.warn('Skipping google-oauth: missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  // OpenRouter
  const openRouterKey = process.env['OPENROUTER_API_KEY']?.trim();
  if (openRouterKey) {
    await upsertSecret(`kaba/${env}/openrouter-api-key`, JSON.stringify({ openrouter_api_key: openRouterKey }));
  } else {
    console.warn('Skipping openrouter-api-key: missing OPENROUTER_API_KEY');
  }

  console.log(`Done. Region: ${region}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
