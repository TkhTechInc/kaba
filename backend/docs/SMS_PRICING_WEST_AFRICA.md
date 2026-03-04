# SMS Pricing – QuickBooks

Approximate per-message costs for OTP and receipts. Prices vary by carrier and volume. **AWS SNS has no free tier** – new accounts have a $1/month default spending limit.

## Comparison

| Provider         | Canada      | Nigeria      | Ghana        | Benin        | Notes                          |
|------------------|-------------|-------------|-------------|--------------|--------------------------------|
| **AWS SNS**      | ~$0.013     | ~$0.008–0.02| ~$0.008–0.02| ~$0.008–0.02 | Pay-as-you-go, no minimums      |
| **Twilio**       | ~$0.34      | ~$0.31      | varies       | Higher cost, strong reliability |
| **Africa's Talking** | ~$0.05–0.06 | ~$0.05–0.06 | CFA 18 (~$0.03) | Often cheapest in West Africa   |

## AWS SNS

- **Pricing:** ~$0.00847 base + carrier fee (varies by country/carrier)
- **Setup:** Uses AWS credentials (IAM role or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`)
- **Docs:** https://aws.amazon.com/sns/sms-pricing/
- **Env:** `SMS_PROVIDER=aws_sns`, `SMS_ENABLED=true`, `AWS_REGION`

## Twilio

- **Pricing:** Nigeria ~$0.34, Ghana ~$0.31 per outbound SMS
- **Setup:** Create account at https://console.twilio.com
- **Docs:** https://www.twilio.com/en-us/sms/pricing
- **Env:** `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

## Africa's Talking

- **Pricing:** ~$0.05–0.06 (Benin CFA 17–19, Burkina $0.06)
- **Setup:** Create account at https://account.africastalking.com
- **Docs:** https://africastalking.com/pricing
- **Env:** `SMS_PROVIDER=africastalking`, `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`, `AFRICASTALKING_SENDER_ID`

## Recommendation for West Africa

- **Africa's Talking** – Often best value for Benin, Nigeria, Ghana, Senegal, Côte d'Ivoire.
- **AWS SNS** – Good if you already use AWS and want a single provider.
- **Twilio** – Use when you need high reliability and can afford higher per-message cost.
