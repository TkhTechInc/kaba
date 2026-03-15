# Vercel CLI Deploy

Deploy the Kaba frontend via Vercel CLI.

## Prerequisites

```bash
npm i -g vercel   # or use npx vercel
vercel login
```

## First-time setup

```bash
cd frontend
vercel link --yes
```

This creates a project (or links to existing) and saves `.vercel/project.json`.

## Add environment variables

```bash
cd frontend

# Production
echo "https://api.dev.kabasika.com" | vercel env add NEXT_PUBLIC_API_URL production
echo "https://api.dev.kabasika.com" | vercel env add NEXT_PUBLIC_API_URL preview

# KkiaPay (optional)
echo "your-key" | vercel env add NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY production --sensitive
echo "true" | vercel env add NEXT_PUBLIC_KKIAPAY_SANDBOX production
```

## Deploy

```bash
cd frontend

# Preview (unique URL per deploy)
vercel deploy

# Production (promotes to production domain)
vercel deploy --prod
```

Or from repo root:

```bash
./scripts/vercel-deploy.sh          # preview
./scripts/vercel-deploy.sh production
```

## Add custom domain

```bash
vercel domains add dev.kabasika.com
```

Then add the CNAME record in your DNS provider (Namecheap, etc.) as Vercel instructs.
