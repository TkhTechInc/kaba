# Kaba Environments

Four environments: **local**, **dev**, **staging**, **prod**.

## Domain convention

| Env     | API URL                      | Frontend URL                 |
|---------|------------------------------|------------------------------|
| local   | `http://localhost:3001`      | `http://localhost:3000`      |
| dev     | `https://api.dev.kabasika.com`   | `https://dev.kabasika.com`   |
| staging | `https://api.staging.kabasika.com` | `https://staging.kabasika.com` |
| prod    | `https://api.kabasika.com`   | `https://app.kabasika.com`   |

**Rule:** dev, staging, and prod **must** use real domains. API Gateway URLs (`*.execute-api.*.amazonaws.com`) are rejected at deploy time.

Override via CDK context when using different domains:

```bash
cdk deploy -c environment=dev -c apiUrl=https://api.dev.example.com -c frontendUrl=https://dev.example.com --all
```

## Local

- Run `npm run dev` in backend and frontend
- No CDK deploy
- CORS allows localhost

## Deployed (dev, staging, prod)

1. **DNS**: Point `api.<env>.kabasika.com` and `<env>.kabasika.com` to API Gateway / CloudFront (or your hosting).
2. **API Gateway custom domain**: Map the custom domain to your REST API stage.
3. **GitHub secrets** (per environment):
   - `NEXT_PUBLIC_API_URL` — must match the real API domain (e.g. `https://api.dev.kabasika.com`)
   - **KkiaPay** (dev vs prod use different keys):
     - **Dev**: `KKIAPAY_SANDBOX_PUBLIC_KEY` = sandbox public key from [KkiaPay sandbox](https://app.kkiapay.me). Fallback: `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY`.
     - **Prod**: `NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY` = live public key from KkiaPay.
     - Dev uses `sandbox: true`, prod uses `sandbox: false`. Key and sandbox flag must match or KkiaPay shows "Your API key is incorrect".
4. **Google OAuth**: Add redirect URI `https://api.<env>.kabasika.com/api/v1/auth/google/callback` in Google Console.

## Validation

`validateEnvironmentConfig` enforces:

- dev/staging/prod have `apiUrl` and `frontendUrl` set
- Neither contains `execute-api` or `amazonaws.com`

## See also

- [SECURITY_PROD.md](./SECURITY_PROD.md) — production checklist
- `backend/src/infrastructure/config/environments.ts` — defaults and overrides
