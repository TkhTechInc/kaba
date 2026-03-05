# Kaba – MSME Accounting for West Africa

MSME accounting SaaS for West Africa. QuickBooks-like ledger, invoicing, payments, and reports.

## Tech Stack

- **Next.js 16** – React framework
- **TypeScript** – Type safety
- **Tailwind CSS** – Styling

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

See `.env.example` for required variables. Key ones:

- `NEXT_PUBLIC_API_URL` – Backend API URL (e.g. `http://localhost:3001` for local)

## Build

```bash
npm run build
npm start
```
