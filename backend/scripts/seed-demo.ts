/**
 * Seed Adama Rice Shop — demo business for investor demos and AI agent testing.
 *
 * Creates a fixed demo business with 30 days of realistic data:
 * - Sales and expenses (rice, oil, transport, rent)
 * - 3 debts: Moussa 25,000, Kossi 10,000, Aminata 5,000 XOF
 * - Customers and products
 * - dailySummaryEnabled: true, phone for WhatsApp
 *
 * Usage:
 *   npm run seed:demo
 *
 * Optional env vars:
 *   DYNAMODB_LEDGER_TABLE, DYNAMODB_INVOICES_TABLE, DYNAMODB_INVENTORY_TABLE
 *   AWS_REGION, DYNAMODB_ENDPOINT
 */
import * as path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '../.env') });

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';

const DEMO_BUSINESS_ID = 'demo-adama-rice-shop';
const ledgerTable = process.env['DYNAMODB_LEDGER_TABLE'] ?? 'Kaba-LedgerService-dev-ledger';
const invoicesTable = process.env['DYNAMODB_INVOICES_TABLE'] ?? 'Kaba-Invoices-dev';
const inventoryTable = process.env['DYNAMODB_INVENTORY_TABLE'] ?? 'Kaba-Inventory-dev';
const region = process.env['AWS_REGION'] ?? 'ca-central-1';
const endpoint = process.env['DYNAMODB_ENDPOINT'];

const client = new DynamoDBClient({ region, ...(endpoint && { endpoint }) });
const doc = DynamoDBDocumentClient.from(client);

function now(): string {
  return new Date().toISOString();
}

function date(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function put(table: string, item: Record<string, unknown>): Promise<void> {
  await doc.send(new PutCommand({ TableName: table, Item: item }));
}

async function updateBalance(delta: number, curr: string): Promise<void> {
  await doc.send(
    new UpdateCommand({
      TableName: ledgerTable,
      Key: { pk: DEMO_BUSINESS_ID, sk: 'BALANCE' },
      UpdateExpression: 'ADD balance :delta SET currency = :currency',
      ExpressionAttributeValues: { ':delta': delta, ':currency': curr },
    }),
  );
}

async function seed(): Promise<void> {
  console.log('Seeding Adama Rice Shop demo business...');
  console.log(`Business ID: ${DEMO_BUSINESS_ID}`);
  console.log(`Tables: ledger=${ledgerTable}, invoices=${invoicesTable}, inventory=${inventoryTable}\n`);

  const currency = 'XOF';
  const nowStr = now();

  // 1. Business META
  await put(ledgerTable, {
    pk: DEMO_BUSINESS_ID,
    sk: 'META',
    entityType: 'BUSINESS',
    id: DEMO_BUSINESS_ID,
    tier: 'pro',
    name: "Adama Rice Shop",
    countryCode: 'BJ',
    currency,
    address: 'Marché Dantokpa, Cotonou',
    phone: '+22990123456',
    onboardingComplete: true,
    dailySummaryEnabled: true,
    slug: 'adama-rice-shop',
    createdAt: nowStr,
    updatedAt: nowStr,
  });
  console.log('  ✓ Business META (Adama Rice Shop, Cotonou)');

  // 2. Ledger entries — 30 days of sales and expenses
  const sales = [
    { desc: 'Vente riz 50kg', category: 'Sales', amount: 25000 },
    { desc: 'Vente huile 5L', category: 'Sales', amount: 8500 },
    { desc: 'Vente sucre 1kg', category: 'Sales', amount: 1200 },
    { desc: 'Vente riz + huile', category: 'Sales', amount: 33500 },
    { desc: 'Vente gros client', category: 'Sales', amount: 45000 },
  ];
  const expenses = [
    { desc: 'Transport', category: 'Transport', amount: 5000 },
    { desc: 'Loyer', category: 'Rent', amount: 25000 },
    { desc: 'Fournitures', category: 'Supplies', amount: 3500 },
    { desc: 'Électricité', category: 'Utilities', amount: 8000 },
  ];
  let balanceDelta = 0;
  for (let d = 0; d < 30; d++) {
    const entryDate = date(d);
    const s = sales[d % sales.length];
    const e = expenses[d % expenses.length];
    const saleAmount = s.amount + (d % 5) * 1000;
    const expAmount = e.amount + (d % 3) * 500;
    await put(ledgerTable, {
      pk: DEMO_BUSINESS_ID,
      sk: `LEDGER#${uuidv4()}`,
      entityType: 'LEDGER',
      id: uuidv4(),
      businessId: DEMO_BUSINESS_ID,
      type: 'sale',
      amount: saleAmount,
      currency,
      description: `${s.desc} (${entryDate})`,
      category: s.category,
      date: entryDate,
      createdAt: nowStr,
    });
    await put(ledgerTable, {
      pk: DEMO_BUSINESS_ID,
      sk: `LEDGER#${uuidv4()}`,
      entityType: 'LEDGER',
      id: uuidv4(),
      businessId: DEMO_BUSINESS_ID,
      type: 'expense',
      amount: expAmount,
      currency,
      description: `${e.desc} (${entryDate})`,
      category: e.category,
      date: entryDate,
      createdAt: nowStr,
    });
    balanceDelta += saleAmount - expAmount;
  }
  await updateBalance(balanceDelta, currency);
  console.log('  ✓ 60 Ledger entries (30 days sales + expenses)');

  // 3. Debts — Moussa, Kossi, Aminata
  const debts = [
    { name: 'Moussa', amount: 25000, phone: '+22997000001' },
    { name: 'Kossi', amount: 10000, phone: '+22997000002' },
    { name: 'Aminata', amount: 5000, phone: '+22997000003' },
  ];
  for (const d of debts) {
    const debtId = uuidv4();
    await put(ledgerTable, {
      pk: DEMO_BUSINESS_ID,
      sk: `DEBT#${debtId}`,
      entityType: 'DEBT',
      id: debtId,
      businessId: DEMO_BUSINESS_ID,
      debtorName: d.name,
      amount: d.amount,
      currency,
      dueDate: date(-5),
      status: 'pending',
      phone: d.phone,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }
  console.log('  ✓ 3 Debts (Moussa 25k, Kossi 10k, Aminata 5k XOF)');

  // 4. Customers
  const customers = [
    { name: 'Moussa Traoré', email: 'moussa@example.com', phone: '+22997000001' },
    { name: 'Kossi Agbé', email: 'kossi@example.com', phone: '+22997000002' },
    { name: 'Aminata Diallo', email: 'aminata@example.com', phone: '+22997000003' },
  ];
  for (const c of customers) {
    const id = uuidv4();
    await put(invoicesTable, {
      pk: DEMO_BUSINESS_ID,
      sk: `CUSTOMER#${id}`,
      entityType: 'CUSTOMER',
      id,
      businessId: DEMO_BUSINESS_ID,
      name: c.name,
      email: c.email,
      phone: c.phone,
    });
  }
  console.log('  ✓ 3 Customers');

  // 5. Products
  const products = [
    { name: 'Riz 50kg', unitPrice: 25000, qty: 20 },
    { name: 'Huile 5L', unitPrice: 8500, qty: 30 },
    { name: 'Sucre 1kg', unitPrice: 1200, qty: 50 },
  ];
  for (const p of products) {
    await put(inventoryTable, {
      pk: DEMO_BUSINESS_ID,
      sk: `PRODUCT#${uuidv4()}`,
      id: uuidv4(),
      businessId: DEMO_BUSINESS_ID,
      name: p.name,
      unitPrice: p.unitPrice,
      currency,
      quantityInStock: p.qty,
      lowStockThreshold: 5,
      createdAt: nowStr,
      updatedAt: nowStr,
    });
  }
  console.log('  ✓ 3 Products');

  console.log('\n✅ Adama Rice Shop demo seed complete.');
  console.log('\nDemo script:');
  console.log('  1. Log in as a user linked to businessId: demo-adama-rice-shop');
  console.log('  2. WhatsApp/Telegram: "Combien j\'ai vendu aujourd\'hui?"');
  console.log('  3. "Qui me doit de l\'argent?" → Moussa 25k, Kossi 10k, Aminata 5k');
  console.log('  4. "Relance Moussa" → sends WhatsApp reminder');
  console.log('  5. "Pourquoi mes ventes ont baissé?" → analyze_trends');
  console.log('  6. PATCH /api/v1/businesses/demo-adama-rice-shop/settings { dailySummaryEnabled: true }');
}

seed().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
