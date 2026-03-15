#!/usr/bin/env node
/**
 * Fetch all dev environment variables from AWS (Lambda + Secrets Manager)
 * and merge them into backend/.env for local development.
 *
 * Usage: node scripts/fetch-dev-env.mjs
 */
import { execSync } from 'child_process';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const region = 'ca-central-1';
const secretsClient = new SecretsManagerClient({ region });

const LAMBDA_FUNCTION = 'Kaba-Api-dev-handler';

// Lambda env vars to copy (skip internal/AWS ones)
const LAMBDA_ENV_WHITELIST = new Set([
  'FRONTEND_URL', 'API_URL', 'CORS_ORIGINS',
  'DYNAMODB_LEDGER_TABLE', 'DYNAMODB_INVOICES_TABLE', 'DYNAMODB_INVENTORY_TABLE',
  'DYNAMODB_AUDIT_LOGS_TABLE', 'DYNAMODB_USERS_TABLE', 'DYNAMODB_IDEMPOTENCY_TABLE',
  'AGENT_SESSIONS_TABLE', 'S3_RECEIPTS_BUCKET',
  'SMS_ENABLED', 'SMS_PROVIDER', 'SMS_SENDER_ID',
  'AI_PROVIDER', 'AI_MODEL', 'AI_INTENT_MODEL', 'AI_VOICE_MODEL', 'AI_LOAN_MODEL',
  'AI_LEDGER_QA_MODEL', 'AI_VISION_MODEL', 'AI_EMBEDDING_MODEL',
  'MOBILE_MONEY_PARSER_PROVIDER',
  'PAYMENTS_SERVICE_URL', 'TKH_PAYMENTS_API_KEY',
]);

async function getLambdaEnv() {
  try {
    const out = execSync(
      `aws lambda get-function-configuration --function-name ${LAMBDA_FUNCTION} --region ${region} --query 'Environment.Variables' --output json`,
      { encoding: 'utf8' }
    );
    return JSON.parse(out) || {};
  } catch (err) {
    console.warn('Could not fetch Lambda config (is it deployed?):', err.message);
    return {};
  }
}

async function getSecret(name, key) {
  try {
    const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: name }));
    const data = JSON.parse(res.SecretString || '{}');
    return data[key];
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return undefined;
    throw err;
  }
}

async function getSecretMulti(name, keys) {
  try {
    const res = await secretsClient.send(new GetSecretValueCommand({ SecretId: name }));
    const data = JSON.parse(res.SecretString || '{}');
    return keys.map((k) => data[k]);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') return keys.map(() => undefined);
    throw err;
  }
}

function parseEnv(content) {
  const out = {};
  for (const line of content.split('\n')) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

function formatEnv(vars) {
  return Object.entries(vars)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
}

async function run() {
  const lambdaEnv = await getLambdaEnv();

  const fetched = {
    // From Lambda
    ...Object.fromEntries(
      Object.entries(lambdaEnv).filter(([k]) => LAMBDA_ENV_WHITELIST.has(k))
    ),
    // TKH Payments uses PAYMENTS_SERVICE_URL in Lambda, .env uses both
    ...(lambdaEnv.PAYMENTS_SERVICE_URL && {
      PAYMENTS_SERVICE_URL: lambdaEnv.PAYMENTS_SERVICE_URL,
      TKH_PAYMENTS_API_KEY: lambdaEnv.TKH_PAYMENTS_API_KEY || '',
    }),
  };

  // Fetch secrets
  const jwtSecret = await getSecret('kaba/dev/jwt-secret', 'jwt_secret');
  if (jwtSecret) fetched.JWT_SECRET = jwtSecret;

  const openRouterKey = await getSecret('kaba/dev/openrouter-api-key', 'openrouter_api_key');
  if (openRouterKey) fetched.OPENROUTER_API_KEY = openRouterKey;

  const [googleClientId, googleClientSecret] = await getSecretMulti('kaba/dev/google-oauth', ['client_id', 'client_secret']);
  if (googleClientId) fetched.GOOGLE_CLIENT_ID = googleClientId;
  if (googleClientSecret) fetched.GOOGLE_CLIENT_SECRET = googleClientSecret;

  // Local dev overrides
  fetched.GOOGLE_CALLBACK_URL = 'http://localhost:3001/api/v1/auth/google/callback';
  fetched.AWS_REGION = region;

  // Merge with existing .env (fetched values override)
  let existing = {};
  if (existsSync(envPath)) {
    existing = parseEnv(readFileSync(envPath, 'utf8'));
  } else {
    const examplePath = resolve(__dirname, '../.env.example');
    if (existsSync(examplePath)) {
      existing = parseEnv(readFileSync(examplePath, 'utf8'));
    }
  }

  const merged = { ...existing, ...fetched };

  // Write .env
  const header = `# Kaba Backend - Dev environment (fetched from AWS ${new Date().toISOString().slice(0, 10)})
# Run: npm run fetch-dev-env to refresh from Lambda + Secrets Manager
`;
  writeFileSync(envPath, header + formatEnv(merged) + '\n', 'utf8');
  console.log(`Updated ${envPath} with ${Object.keys(fetched).length} variables from AWS`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
