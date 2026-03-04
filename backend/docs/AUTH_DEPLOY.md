# Auth Setup for Deployment

## JWT Secret (Required for Lambda)

The API Lambda loads the JWT secret from AWS Secrets Manager. Create the secret **before** deploying:

```bash
# Replace YOUR_SECRET with a strong random value (e.g. openssl rand -base64 32)
aws secretsmanager create-secret \
  --name quickbooks/dev/jwt-secret \
  --secret-string '{"jwt_secret":"YOUR_SECRET"}' \
  --region af-south-1
```

For staging/prod, use the matching path:

- `quickbooks/staging/jwt-secret`
- `quickbooks/prod/jwt-secret`

## Deploy with Frontend URL (CORS)

When the frontend is hosted (e.g. Amplify, Vercel), pass its URL so the API allows CORS:

```bash
cdk deploy -c environment=dev -c frontendUrl=https://dev.yourapp.com --all
```

## Auth Flows

| Method | Endpoint | Notes |
|--------|----------|-------|
| Phone + OTP | `POST /api/v1/auth/send-otp` → `POST /api/v1/auth/login` | SMS or dev console |
| Email + Password | `POST /api/v1/auth/login/email` | Sign up first |
| Sign Up | `POST /api/v1/auth/sign-up` | Creates user + default business |
| Voice OTP | `POST /api/v1/auth/send-voice-otp` | Africa's Talking only |
| Google/Facebook | `GET /api/v1/auth/google` etc. | OAuth redirect flow |

## Local Dev

1. Copy `.env.example` to `.env`
2. Set `JWT_SECRET` (or use default dev-secret)
3. Set `DYNAMODB_LEDGER_TABLE` to your deployed table name (e.g. `QuickBooks-LedgerService-dev-ledger`) if connecting to AWS
4. Run `npm run dev`
5. Frontend: set `NEXT_PUBLIC_API_URL=http://localhost:3001`
