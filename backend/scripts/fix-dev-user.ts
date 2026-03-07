/**
 * One-shot dev-environment fix.
 *
 * Ensures a Google OAuth user has exactly ONE correctly-configured business
 * in the right DynamoDB tables, with pro tier, onboarding complete, and all
 * TeamMember records consistent.
 *
 * Usage:
 *   SEED_EMAIL=you@example.com npm run fix-dev
 *   SEED_EMAIL=you@example.com SEED_BUSINESS_ID=biz_xxx npm run fix-dev  # force specific bizId
 *
 * After running, paste this in the browser console and reload:
 *   localStorage.setItem('qb_business_id', '<printed businessId>'); location.reload();
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const USERS_TABLE  = process.env['DYNAMODB_USERS_TABLE']  || 'Kaba-UsersService-dev-users';
const LEDGER_TABLE = process.env['DYNAMODB_LEDGER_TABLE'] || 'Kaba-LedgerService-dev-ledger';
const REGION       = process.env['AWS_REGION'] || 'ca-central-1';

const seedEmail  = (process.env['SEED_EMAIL'] || '').toLowerCase().trim();
const forceBizId = process.env['SEED_BUSINESS_ID'] || '';

if (!seedEmail) {
  console.error('SEED_EMAIL is required. Usage: SEED_EMAIL=you@example.com npm run fix-dev');
  process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(client);

async function getUserId(email: string): Promise<string | null> {
  const res = await doc.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { pk: `EMAIL#${email}`, sk: 'META' },
  }));
  return res.Item?.userId ? String(res.Item.userId) : null;
}

async function listUserBusinesses(userId: string): Promise<string[]> {
  const res = await doc.send(new QueryCommand({
    TableName: LEDGER_TABLE,
    KeyConditionExpression: 'pk = :pk AND begins_with(sk, :sk)',
    ExpressionAttributeValues: { ':pk': `USER#${userId}`, ':sk': 'BUSINESS#' },
  }));
  return (res.Items ?? []).map(i => String(i.businessId)).filter(Boolean);
}

async function getBusinessMeta(bizId: string) {
  const res = await doc.send(new GetCommand({
    TableName: LEDGER_TABLE,
    Key: { pk: bizId, sk: 'META' },
  }));
  return res.Item ?? null;
}

async function run() {
  const NOW = new Date().toISOString();
  console.log(`\n🔧 fix-dev-user for ${seedEmail}`);

  // ── 1. Resolve userId ──────────────────────────────────────────────────────
  let userId = await getUserId(seedEmail);
  if (!userId) {
    console.error(`No user found for ${seedEmail}. Sign in with Google first, then re-run.`);
    process.exit(1);
  }
  console.log(`  userId: ${userId}`);

  // ── 2. Find existing businesses ────────────────────────────────────────────
  const existingBizIds = await listUserBusinesses(userId);
  console.log(`  Existing businesses: ${existingBizIds.length ? existingBizIds.join(', ') : 'none'}`);

  // Pick the target: forced > first existing with data > first existing > new
  let targetBizId = forceBizId;
  if (!targetBizId && existingBizIds.length > 0) {
    // Prefer one with a name set (was actually onboarded)
    for (const bid of existingBizIds) {
      const meta = await getBusinessMeta(bid);
      if (meta?.name) { targetBizId = bid; break; }
    }
    if (!targetBizId) targetBizId = existingBizIds[0];
  }
  if (!targetBizId) {
    targetBizId = `biz_${uuidv4().slice(0, 8)}`;
    console.log(`  Creating new business: ${targetBizId}`);
  } else {
    console.log(`  Target business: ${targetBizId}`);
  }

  // ── 3. Remove stray businesses (keep only target) ─────────────────────────
  const stray = existingBizIds.filter(b => b !== targetBizId);
  for (const bid of stray) {
    await doc.send(new DeleteCommand({
      TableName: LEDGER_TABLE,
      Key: { pk: `USER#${userId}`, sk: `BUSINESS#${bid}` },
    }));
    await doc.send(new DeleteCommand({
      TableName: LEDGER_TABLE,
      Key: { pk: `BUSINESS#${bid}`, sk: `MEMBER#${userId}` },
    }));
    console.log(`  🗑  Removed stray business: ${bid}`);
  }

  // ── 4. Upsert business META ────────────────────────────────────────────────
  const existingMeta = await getBusinessMeta(targetBizId);
  await doc.send(new PutCommand({
    TableName: LEDGER_TABLE,
    Item: {
      pk: targetBizId, sk: 'META',
      entityType: 'BUSINESS', id: targetBizId,
      name:          existingMeta?.name        ?? 'My Business',
      tier:          'pro',
      currency:      existingMeta?.currency    ?? 'XOF',
      countryCode:   existingMeta?.countryCode ?? 'BJ',
      businessType:  existingMeta?.businessType ?? 'retail',
      taxRegime:     existingMeta?.taxRegime    ?? 'simplified',
      onboardingComplete: true,
      createdAt: existingMeta?.createdAt ?? NOW,
      updatedAt: NOW,
    },
  }));
  console.log(`  ✅ Business META (pro, onboarding complete)`);

  // ── 5. Upsert onboarding record ────────────────────────────────────────────
  await doc.send(new PutCommand({
    TableName: LEDGER_TABLE,
    Item: {
      pk: targetBizId, sk: 'ONBOARDING',
      entityType: 'ONBOARDING',
      businessId: targetBizId, userId,
      step: 'details',
      completedSteps: ['businessName','businessType','country','currency','taxRegime','details'],
      answers: {
        businessName:  existingMeta?.name        ?? 'My Business',
        businessType:  existingMeta?.businessType ?? 'retail',
        country:       existingMeta?.countryCode  ?? 'BJ',
        currency:      existingMeta?.currency     ?? 'XOF',
        taxRegime:     existingMeta?.taxRegime    ?? 'simplified',
      },
      startedAt: NOW, completedAt: NOW,
    },
  }));
  console.log(`  ✅ Onboarding marked complete`);

  // ── 6. Upsert TeamMember records (bidirectional) in ledger table ───────────
  await doc.send(new PutCommand({
    TableName: LEDGER_TABLE,
    Item: {
      pk: `BUSINESS#${targetBizId}`, sk: `MEMBER#${userId}`,
      entityType: 'TEAM_MEMBER', userId,
      businessId: targetBizId, role: 'owner', createdAt: NOW,
    },
  }));
  await doc.send(new PutCommand({
    TableName: LEDGER_TABLE,
    Item: {
      pk: `USER#${userId}`, sk: `BUSINESS#${targetBizId}`,
      entityType: 'TEAM_MEMBER', userId,
      businessId: targetBizId, role: 'owner', createdAt: NOW,
    },
  }));
  console.log(`  ✅ TeamMember records (owner)`);

  // ── 7. Upsert user as admin in users table ─────────────────────────────────
  await doc.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      pk: `USER#${userId}`, sk: 'META',
      id: userId, email: seedEmail,
      provider: userId.startsWith('google_') ? 'google' : 'email',
      role: 'admin', emailVerified: true,
      createdAt: NOW, updatedAt: NOW,
    },
  }));
  console.log(`  ✅ User role → admin`);

  console.log(`
✅ Done! Run this in the browser console then reload:

  localStorage.setItem('qb_business_id', '${targetBizId}'); location.reload();

businessId: ${targetBizId}
`);
}

run().catch(e => { console.error('fix-dev-user failed:', e); process.exit(1); });
