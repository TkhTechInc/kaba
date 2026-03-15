/**
 * Integration test for fix-dev with SEED_KEEP_EXISTING=true.
 *
 * Prerequisites:
 * - DynamoDB tables available (local or AWS)
 * - A user exists for SEED_EMAIL (sign in with Google first)
 * - User has at least 2 businesses
 *
 * Run:
 *   SEED_EMAIL=you@example.com SEED_BUSINESS_ID=demo-adama-rice-shop SEED_KEEP_EXISTING=true \
 *   npm test -- --testPathPattern=fix-dev-keep-existing --runInBand
 *
 * The test runs fix-dev as a subprocess, then verifies all original businesses are retained.
 */
import * as path from 'path';
import { spawn } from 'child_process';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../../.env') });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

const LEDGER_TABLE = process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-LedgerService-dev-ledger';
const USERS_TABLE = process.env['DYNAMODB_USERS_TABLE'] ?? 'Kaba-UsersService-dev-users';
const REGION = process.env['AWS_REGION'] ?? 'ca-central-1';
const ENDPOINT = process.env['DYNAMODB_ENDPOINT'];

const client = new DynamoDBClient({ region: REGION, ...(ENDPOINT && { endpoint: ENDPOINT }) });
const doc = DynamoDBDocumentClient.from(client);

async function getUserId(email: string): Promise<string | null> {
  const res = await doc.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `EMAIL#${email.toLowerCase().trim()}`, sk: 'META' },
  }));
  return res.Item?.userId ? String(res.Item.userId) : null;
}

async function listUserBusinesses(userId: string): Promise<string[]> {
  const res = await doc.send(new QueryCommand({
    TableName: LEDGER_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'BUSINESS#' },
  }));
  return (res.Items ?? []).map((i) => String(i.businessId)).filter(Boolean);
}

function runFixDev(env: Record<string, string>): Promise<{ exitCode: number }> {
  return new Promise((resolve) => {
    const proc = spawn('npx', ['ts-node', '-r', 'tsconfig-paths/register', 'scripts/fix-dev-user.ts'], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, ...env },
      stdio: 'pipe',
    });
    proc.on('close', (code) => resolve({ exitCode: code ?? 1 }));
  });
}

describe('fix-dev SEED_KEEP_EXISTING (integration)', () => {
  const seedEmail = process.env['SEED_EMAIL']?.toLowerCase().trim();
  const seedBizId = process.env['SEED_BUSINESS_ID'];

  it('retains all businesses when SEED_KEEP_EXISTING=true', async () => {
    if (!seedEmail || !seedBizId) {
      console.log('Skipping: set SEED_EMAIL and SEED_BUSINESS_ID to run');
      return;
    }

    const userId = await getUserId(seedEmail);
    if (!userId) {
      console.log('Skipping: no user found for', seedEmail, '- sign in first');
      return;
    }

    const businessesBefore = await listUserBusinesses(userId);
    if (businessesBefore.length < 2) {
      console.log('Skipping: user has', businessesBefore.length, 'businesses, need 2+ to test');
      return;
    }

    const { exitCode } = await runFixDev({
      SEED_EMAIL: seedEmail,
      SEED_BUSINESS_ID: seedBizId,
      SEED_KEEP_EXISTING: 'true',
    });
    expect(exitCode).toBe(0);

    const businessesAfter = await listUserBusinesses(userId);
    expect(businessesAfter.length).toBeGreaterThanOrEqual(businessesBefore.length);
    expect(businessesAfter).toContain(seedBizId);
    for (const b of businessesBefore) {
      expect(businessesAfter).toContain(b);
    }
  }, 30000);
});
