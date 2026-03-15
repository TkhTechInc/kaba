# Production Security Checklist

Zero-cost security measures enforced when `NODE_ENV=production`. See `backend/.env.example` for all variables.

## Required (app fails to start if missing)

| Variable | Purpose |
|---------|---------|
| `JWT_SECRET` | Must not be dev default. Use Secrets Manager or strong random value. |
| `CORS_ORIGINS` | Comma-separated frontend URLs (e.g. `https://app.kabasika.com`). No wildcards. |

## Strongly recommended

| Variable | Purpose |
|---------|---------|
| `USSD_API_KEY` | USSD endpoint rejects requests if unset in production. |
| `API_URL` | Public API URL for trust share links, webhooks. |
| `FRONTEND_URL` | OAuth redirects, password reset links. |

## Deploy (CDK)

`apiUrl` and `frontendUrl` have defaults in `environments.ts`; override if needed:

```bash
cdk deploy -c environment=prod \
  -c apiUrl=https://api.kabasika.com \
  -c frontendUrl=https://app.kabasika.com \
  --all --require-approval broadening
```

See [ENVIRONMENTS.md](./ENVIRONMENTS.md) for the 4-env domain convention.

## What's enforced

- **JWT**: Rejects dev secret in production.
- **CORS**: Requires explicit origins; never `origin: true` in prod.
- **USSD**: Requires `USSD_API_KEY`; rejects unauthenticated requests.
- **Trust proxy**: Enabled for correct client IP behind API Gateway.
- **Error responses**: 500 errors use generic message in prod; stack traces only in logs.

## Rate limiting

- Global: 200 req/min per IP.
- Auth endpoints: 5 req/min.
- Admin endpoints: 5 req/min.

## See also

- [CONFIG_REMINDER.md](./CONFIG_REMINDER.md) — S3, payments, email, SES.
