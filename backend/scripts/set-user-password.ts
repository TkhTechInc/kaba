/**
 * Set password for an existing user (e.g. OAuth user with no password).
 *
 * Usage:
 *   SEED_EMAIL=lloydharold14@gmail.com SEED_PASSWORD='Campus2020$' npm run set-user-password
 *
 * Requires: user must exist (e.g. created via Google sign-in).
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import * as bcrypt from 'bcryptjs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const USERS_TABLE = process.env['DYNAMODB_USERS_TABLE'] || 'Kaba-UsersService-dev-users';
const REGION = process.env['AWS_REGION'] || 'ca-central-1';
const SALT_ROUNDS = 10;

const seedEmail = (process.env['SEED_EMAIL'] || '').toLowerCase().trim();
const seedPassword = process.env['SEED_PASSWORD'] || '';

if (!seedEmail || !seedPassword) {
  console.error('Usage: SEED_EMAIL=you@example.com SEED_PASSWORD=your-password npm run set-user-password');
  process.exit(1);
}

const client = new DynamoDBClient({ region: REGION });
const doc = DynamoDBDocumentClient.from(client);

async function run() {
  // 1. Resolve userId from email
  const emailRes = await doc.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: `EMAIL#${seedEmail}`, sk: 'META' },
    }),
  );

  if (!emailRes.Item?.userId) {
    console.error(`No user found for ${seedEmail}. Sign in with Google first, then re-run.`);
    process.exit(1);
  }

  const userId = String(emailRes.Item.userId);
  const userPk = `USER#${userId}`;

  // 2. Verify user record exists
  const userRes = await doc.send(
    new GetCommand({
      TableName: USERS_TABLE,
      Key: { pk: userPk, sk: 'META' },
    }),
  );

  if (!userRes.Item) {
    console.error(`User record not found for ${userId}`);
    process.exit(1);
  }

  // 3. Hash password

  const passwordHash = await bcrypt.hash(seedPassword, SALT_ROUNDS);

  // 4. Update user with passwordHash
  await doc.send(
    new UpdateCommand({
      TableName: USERS_TABLE,
      Key: { pk: userPk, sk: 'META' },
      UpdateExpression: 'SET passwordHash = :hash, updatedAt = :now',
      ExpressionAttributeValues: {
        ':hash': passwordHash,
        ':now': new Date().toISOString(),
      },
    }),
  );

  console.log(`✅ Password set for ${seedEmail} (${userId})`);
}

run().catch((e) => {
  console.error('set-user-password failed:', e);
  process.exit(1);
});
