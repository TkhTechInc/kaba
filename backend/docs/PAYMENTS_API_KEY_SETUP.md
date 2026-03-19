# TKH Payments API Key Setup

Payment links fail with `"Invalid or missing API key. Provide X-API-Key header"` when the API key is not configured or does not match the Payments service.

## How It Works

1. **Payments service** reads the expected key from SSM `/tkh-payments/<env>/tkh-api-key-hash`.
2. **Kaba** must send that same value in the `X-API-Key` header when calling TKH Payments.
3. **PaymentsClient** reads `TKH_PAYMENTS_API_KEY` from env and sends it as `X-API-Key` (only when set).

## Setup

### Lambda (deployed)

Kaba CDK reads the key from SSM when `paymentsServiceUrl` is set:

- **SSM path:** `/kaba/<env>/payments-api-key` (e.g. `/kaba/dev/payments-api-key`)
- **Value:** Must exactly match the value in Payments SSM `/tkh-payments/<env>/tkh-api-key-hash`

Create the parameter (get the value from the Payments team). Use `String` type — CloudFormation does not support SecureString for dynamic references:

```bash
aws ssm put-parameter \
  --name "/kaba/dev/payments-api-key" \
  --value "<same-value-as-tkh-api-key-hash>" \
  --type String \
  --region ca-central-1
```

Or override at deploy time:

```bash
cdk deploy -c environment=dev -c tkhPaymentsApiKey=<value>
```

### Local development

1. Add to `backend/.env`:
   ```
   TKH_PAYMENTS_API_KEY=<value-from-payments-team>
   ```

2. Or run `node scripts/fetch-dev-env.mjs` to pull from the deployed Lambda (requires Lambda to already have the key).

## Verification

- **PaymentsClient** logs a warning at startup if `TKH_PAYMENTS_API_KEY` is not set.
- Check backend logs when generating a payment link; missing key will show the warning and the Payments service will return 400.
