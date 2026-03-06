# Auth Setup for Deployment

## JWT Secret (Required for Lambda)

The API Lambda loads the JWT secret from AWS Secrets Manager. Create the secret **before** deploying:

```bash
# Replace YOUR_SECRET with a strong random value (e.g. openssl rand -base64 32)
# Use the same region as your deployment (dev: ca-central-1, staging/prod: af-south-1)
aws secretsmanager create-secret \
  --name kaba/dev/jwt-secret \
  --secret-string '{"jwt_secret":"YOUR_SECRET"}' \
  --region ca-central-1
```

For staging/prod, use the matching path:

- `kaba/staging/jwt-secret`
- `kaba/prod/jwt-secret`

## Deploy with Frontend URL (CORS)

When the frontend is hosted (e.g. Amplify, Vercel), pass its URL so the API allows CORS:

```bash
cdk deploy -c environment=dev -c frontendUrl=https://dev.yourapp.com --all
```

## Google OAuth (Local Dev)

When using a **local backend** (frontend → `http://localhost:3001`), add this to Google Cloud Console → Credentials → OAuth client → **Authorized redirect URIs**:

```
http://localhost:3001/api/v1/auth/google/callback
```

Google allows multiple redirect URIs per client, so you can have both localhost and your deployed URL.

## Google OAuth (Lambda)

For localhost frontend → AWS backend, pass Google credentials at deploy time:

```bash
cdk deploy -c environment=dev \
  -c frontendUrl=http://localhost:3000 \
  -c googleClientId=YOUR_CLIENT_ID.apps.googleusercontent.com \
  -c googleClientSecret=YOUR_CLIENT_SECRET \
  --all --require-approval never
```

Then add the **deployed callback URL** to Google Cloud Console → Credentials → OAuth client → Authorized redirect URIs:

```
https://YOUR_API_ID.execute-api.ca-central-1.amazonaws.com/dev/api/v1/auth/google/callback
```

(Replace `YOUR_API_ID` with your actual API Gateway ID, e.g. `gvjyf5lixl` from your URL.)

## Auth Flows

| Method | Endpoint | Notes |
|--------|----------|-------|
| Phone + OTP | `POST /api/v1/auth/send-otp` → `POST /api/v1/auth/login` | SMS or dev console |
| Email + Password | `POST /api/v1/auth/login/email` | Sign up first |
| Sign Up | `POST /api/v1/auth/sign-up` | Creates user + default business |
| Voice OTP | `POST /api/v1/auth/send-voice-otp` | Africa's Talking only |
| Google/Facebook | `GET /api/v1/auth/google` etc. | OAuth redirect flow |

## AI / Mobile Money Parsing (Lambda)

For mobile money SMS parsing and AI features, configure OpenRouter at deploy time:

1. Create the OpenRouter API key secret (same region as deployment):

```bash
aws secretsmanager create-secret \
  --name kaba/dev/openrouter-api-key \
  --secret-string '{"openrouter_api_key":"sk-or-v1-YOUR_KEY"}' \
  --region ca-central-1
```

2. Deploy with AI config:

```bash
cdk deploy -c environment=dev \
  -c aiProvider=openrouter \
  -c aiModel=openrouter/free \
  -c mobileMoneyParserProvider=llm \
  --all --require-approval never
```

For staging/prod, use `kaba/staging/openrouter-api-key` or `kaba/prod/openrouter-api-key`.

## Local Dev

1. Copy `.env.example` to `.env`
2. Set `JWT_SECRET` (or use default dev-secret)
3. Set `DYNAMODB_LEDGER_TABLE` to your deployed table name (e.g. `Kaba-LedgerService-dev-ledger`) if connecting to AWS
4. **Google OAuth**: Add `http://localhost:3001/api/v1/auth/google/callback` to your OAuth client's Authorized redirect URIs (see above)
5. Run `npm run dev`
6. Frontend: set `NEXT_PUBLIC_API_URL=http://localhost:3001` for local backend, or the AWS URL for deployed backend
