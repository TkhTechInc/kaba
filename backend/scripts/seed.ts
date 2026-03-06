/**
 * Seed script to populate DynamoDB with sample data for testing list CRUD operations.
 *
 * Usage:
 *   SEED_BUSINESS_ID=<your-business-id> npm run seed
 *   SEED_EMAIL=<your-email> npm run seed   # looks up businessId from your account
 *
 * Get your businessId from the app: localStorage qb_business_id, or from the API when logged in.
 *
 * Optional env vars (defaults match backend config):
 *   DYNAMODB_LEDGER_TABLE, DYNAMODB_INVOICES_TABLE, DYNAMODB_INVENTORY_TABLE
 *   DYNAMODB_USERS_TABLE (for SEED_EMAIL lookup)
 *   AWS_REGION, DYNAMODB_ENDPOINT (for local DynamoDB)
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const seedEmail = process.env['SEED_EMAIL'] || '';
const businessId =
  process.env['SEED_BUSINESS_ID'] ||
  process.env['BUSINESS_ID'] ||
  '';

const ledgerTable =
  process.env['DYNAMODB_LEDGER_TABLE'] || 'Kaba-LedgerService-dev-ledger';
const invoicesTable =
  process.env['DYNAMODB_INVOICES_TABLE'] || 'Kaba-Invoices-dev';
const inventoryTable =
  process.env['DYNAMODB_INVENTORY_TABLE'] || 'Kaba-Inventory-dev';
const usersTable =
  process.env['DYNAMODB_USERS_TABLE'] || 'Kaba-UsersService-dev-users';

const region = process.env['AWS_REGION'] || 'af-south-1';
const endpoint = process.env['DYNAMODB_ENDPOINT'];

const client = new DynamoDBClient({
  region,
  ...(endpoint && { endpoint }),
});
const doc = DynamoDBDocumentClient.from(client);

async function put(
  table: string,
  item: Record<string, unknown>,
): Promise<void> {
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: item,
    }),
  );
}

async function putIfNotExists(
  table: string,
  item: Record<string, unknown>,
): Promise<boolean> {
  try {
    await doc.send(
      new PutCommand({
        TableName: table,
        Item: item,
        ConditionExpression: 'attribute_not_exists(pk) AND attribute_not_exists(sk)',
      }),
    );
    return true;
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
      return false; // already exists, skip
    }
    throw e;
  }
}

async function updateBalance(
  table: string,
  bid: string,
  delta: number,
  curr: string,
): Promise<void> {
  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { pk: bid, sk: 'BALANCE' },
      UpdateExpression: 'ADD balance :delta SET currency = :currency',
      ExpressionAttributeValues: { ':delta': delta, ':currency': curr },
    }),
  );
}

function now(): string {
  return new Date().toISOString();
}

function date(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/** Look up businessId from user email via Users + TeamMember (ledger table). */
async function resolveBusinessIdFromEmail(email: string): Promise<string | null> {
  const normalized = email.toLowerCase().trim();
  const emailKey = `EMAIL#${normalized}`;
  const userResult = await doc.send(
    new GetCommand({
      TableName: usersTable,
      Key: { pk: emailKey, sk: 'META' },
    }),
  );
  const userId = userResult.Item?.userId as string | undefined;
  if (!userId) return null;

  const teamResult = await doc.send(
    new QueryCommand({
      TableName: ledgerTable,
      KeyConditionExpression: 'pk = :pk AND begins_with(sk, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':skPrefix': 'BUSINESS#',
      },
      Limit: 1,
    }),
  );
  const item = teamResult.Items?.[0];
  return item?.businessId != null ? String(item.businessId) : null;
}

async function seed(): Promise<void> {
  let bid = businessId;
  if (!bid && seedEmail) {
    console.log(`Looking up businessId for ${seedEmail}...`);
    const found = await resolveBusinessIdFromEmail(seedEmail);
    if (found) {
      bid = found;
      console.log(`  Found businessId: ${bid}`);
    } else {
      console.error(`No business found for ${seedEmail}. Sign in first to create one.`);
      process.exit(1);
    }
  }

  if (!bid) {
    console.error(`
SEED_BUSINESS_ID or SEED_EMAIL is required.

Option 1 - by email (looks up your business):
  SEED_EMAIL=lloydharold14@gmail.com npm run seed

Option 2 - by business ID:
  1. Log in to the app
  2. Open DevTools > Application > Local Storage
  3. Find qb_business_id
  4. SEED_BUSINESS_ID=<your-business-id> npm run seed
`);
    process.exit(1);
  }

  console.log(`Seeding data for businessId: ${bid}`);
  console.log(`Tables: ledger=${ledgerTable}, invoices=${invoicesTable}, inventory=${inventoryTable}`);

  const currency = 'XOF';

  // 1. Ensure Business META exists (in ledger table) - skip if already exists
  try {
    await doc.send(
      new PutCommand({
        TableName: ledgerTable,
        Item: {
          pk: bid,
          sk: 'META',
          entityType: 'BUSINESS',
          id: bid,
          tier: 'starter',
          name: 'Seed Business',
          countryCode: 'BJ',
          currency,
          onboardingComplete: true,
          createdAt: now(),
          updatedAt: now(),
        },
        ConditionExpression: 'attribute_not_exists(sk)',
      }),
    );
    console.log('  ✓ Business META');
  } catch (e: unknown) {
    if ((e as { name?: string })?.name === 'ConditionalCheckFailedException') {
      console.log('  ✓ Business META (already exists)');
    } else {
      throw e;
    }
  }

  // 2. Customers (invoices table) - 55 for pagination (page size 20 → 3 pages)
  const firstNames = ['Marie', 'Amadou', 'Fatou', 'Kofi', 'Amina', 'Jean', 'Pierre', 'Aisha', 'Oumar', 'Mariam', 'Ibrahim', 'Adama', 'Seydou', 'Ramatou', 'Bakary', 'Aissata', 'Moussa', 'Hawa', 'Modibo', 'Fatoumata'];
  const lastNames = ['Kouassi', 'Diallo', 'Sow', 'Mensah', 'Ouedraogo', 'Dupont', 'Martin', 'Bello', 'Traoré', 'Keita', 'Sall', 'Cissé', 'Ba', 'Diallo', 'Koné', 'Touré', 'Camara', 'Sidibé', 'Coulibaly', 'Diop'];
  const customerIds: string[] = [];
  let newCustomers = 0;
  for (let i = 0; i < 55; i++) {
    const fn = firstNames[i % firstNames.length];
    const ln = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    const name = `${fn} ${ln}${i >= 20 ? ` ${i}` : ''}`;
    const id = uuidv4();
    const inserted = await putIfNotExists(invoicesTable, {
      pk: bid,
      sk: `CUSTOMER#${id}`,
      entityType: 'CUSTOMER',
      id,
      businessId: bid,
      name,
      email: `customer${i}@example.com`,
      phone: `+2299${String(i).padStart(7, '0')}`,
    });
    if (inserted) newCustomers++;
    customerIds.push(id);
  }
  console.log(`  ✓ 55 Customers (${newCustomers} new)`);

  // 3. Products (inventory table) - 65 for pagination (page size 50 → 2 pages)
  const productTemplates = [
    { name: 'Bag of Rice 50kg', brand: 'Local', unitPrice: 25000, qty: 50, lowStock: 10 },
    { name: 'Vegetable Oil 5L', brand: 'Frytol', unitPrice: 8500, qty: 100, lowStock: 20 },
    { name: 'Sugar 1kg', brand: 'Sucre', unitPrice: 1200, qty: 200, lowStock: 50 },
    { name: 'Tomato Paste 400g', brand: 'Gino', unitPrice: 800, qty: 150, lowStock: 30 },
    { name: 'Maggi Cube', brand: 'Maggi', unitPrice: 150, qty: 500, lowStock: 100 },
    { name: 'Spaghetti 500g', brand: 'Pates', unitPrice: 600, qty: 80, lowStock: 15 },
    { name: 'Milk 1L', brand: 'Dano', unitPrice: 1200, qty: 60, lowStock: 20 },
    { name: 'Bread loaf', brand: 'Local', unitPrice: 300, qty: 120, lowStock: 30 },
    { name: 'Eggs tray 30', brand: 'Local', unitPrice: 2500, qty: 40, lowStock: 10 },
    { name: 'Chicken 1kg', brand: 'Local', unitPrice: 3500, qty: 25, lowStock: 5 },
  ];
  const productIds: string[] = [];
  let newProducts = 0;
  for (let i = 0; i < 65; i++) {
    const t = productTemplates[i % productTemplates.length];
    const id = uuidv4();
    const nowStr = now();
    const name = i >= productTemplates.length ? `${t.name} #${i + 1}` : t.name;
    const inserted = await putIfNotExists(inventoryTable, {
      pk: bid,
      sk: `PRODUCT#${id}`,
      id,
      businessId: bid,
      name,
      brand: t.brand,
      unitPrice: t.unitPrice + (i % 5) * 100,
      currency,
      quantityInStock: Math.max(5, t.qty - i * 2),
      lowStockThreshold: t.lowStock,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
    if (inserted) newProducts++;
    productIds.push(id);
  }
  console.log(`  ✓ 65 Products (${newProducts} new)`);

  // 4. Ledger entries + balance (ledger table) - 55 for pagination (page size 20 → 3 pages)
  const ledgerTemplates = [
    { type: 'sale' as const, desc: 'Rice sale', category: 'Sales', amount: 25000 },
    { type: 'sale' as const, desc: 'Oil sale', category: 'Sales', amount: 17000 },
    { type: 'expense' as const, desc: 'Transport', category: 'Transport', amount: 5000 },
    { type: 'sale' as const, desc: 'Sugar sale', category: 'Sales', amount: 3600 },
    { type: 'expense' as const, desc: 'Office supplies', category: 'Supplies', amount: 1500 },
    { type: 'sale' as const, desc: 'Bulk order', category: 'Sales', amount: 45000 },
    { type: 'expense' as const, desc: 'Rent', category: 'Rent', amount: 80000 },
    { type: 'sale' as const, desc: 'Retail sale', category: 'Sales', amount: 12000 },
    { type: 'expense' as const, desc: 'Utilities', category: 'Utilities', amount: 3500 },
    { type: 'sale' as const, desc: 'Wholesale', category: 'Sales', amount: 28000 },
  ];
  let balanceDelta = 0;
  let newEntries = 0;
  for (let i = 0; i < 55; i++) {
    const t = ledgerTemplates[i % ledgerTemplates.length];
    const id = uuidv4();
    const nowStr = now();
    const amount = t.amount + (i % 7) * 500;
    const entryDate = date(i % 30);
    const inserted = await putIfNotExists(ledgerTable, {
      pk: bid,
      sk: `LEDGER#${id}`,
      entityType: 'LEDGER',
      id,
      businessId: bid,
      type: t.type,
      amount,
      currency,
      description: `${t.desc} #${i + 1}`,
      category: t.category,
      date: entryDate,
      createdAt: nowStr,
    });
    if (inserted) {
      newEntries++;
      balanceDelta += t.type === 'sale' ? amount : -amount;
    }
  }
  if (newEntries > 0) {
    await updateBalance(ledgerTable, bid, balanceDelta, currency);
  }
  console.log(`  ✓ 55 Ledger entries + Balance (${newEntries} new)`);

  // 5. Invoices (invoices table) - 45 for pagination (page size 20 → 3 pages)
  const invoiceItems = [
    { description: 'Bag of Rice 50kg', quantity: 1, unitPrice: 25000, amount: 25000 },
    { description: 'Vegetable Oil 5L', quantity: 2, unitPrice: 8500, amount: 17000 },
  ];
  const statuses: Array<'draft' | 'sent' | 'paid'> = ['draft', 'sent', 'paid'];
  let newInvoices = 0;
  for (let i = 0; i < 45; i++) {
    const id = uuidv4();
    const nowStr = now();
    const dueDate = date(i % 14 + 7);
    const baseAmount = 25000 + 17000;
    const amount = baseAmount + (i % 10) * 5000;
    const status = statuses[i % 3];
    const inserted = await putIfNotExists(invoicesTable, {
      pk: bid,
      sk: `INVOICE#${id}`,
      entityType: 'INVOICE',
      id,
      businessId: bid,
      customerId: customerIds[i % customerIds.length],
      amount,
      currency,
      status,
      items: invoiceItems,
      dueDate,
      createdAt: nowStr,
    });
    if (inserted) newInvoices++;
  }
  console.log(`  ✓ 45 Invoices (${newInvoices} new)`);

  // 6. Debts (ledger table - DEBT#) - 45 for pagination (page size 20 → 3 pages)
  const debtorNames = ['Jean Dupont', 'Aisha Bello', 'Pierre Martin', 'Re Gannon', 'Gbodja', 'Oumar Sow', 'Mariam Diallo', 'Ibrahim Keita', 'Adama Traoré', 'Seydou Ba', 'Ramatou Cissé', 'Bakary Koné', 'Aissata Touré', 'Moussa Camara', 'Hawa Sidibé'];
  let newDebts = 0;
  for (let i = 0; i < 45; i++) {
    const id = uuidv4();
    const nowStr = now();
    const daysAgo = (i % 20) - 5; // mix of past and future due dates
    const dueDate = date(daysAgo);
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const status = i % 5 === 0 ? 'paid' : due < today ? 'overdue' : 'pending';
    const amount = 5000 + (i % 15) * 3000;
    const name = debtorNames[i % debtorNames.length] + (i >= debtorNames.length ? ` #${i}` : '');
    const inserted = await putIfNotExists(ledgerTable, {
      pk: bid,
      sk: `DEBT#${id}`,
      entityType: 'DEBT',
      id,
      businessId: bid,
      debtorName: name,
      amount,
      currency,
      dueDate,
      status,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
    if (inserted) newDebts++;
  }
  console.log(`  ✓ 45 Debts (${newDebts} new)`);

  console.log('\n✅ Seed complete. Refresh the app to see the data.');
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
