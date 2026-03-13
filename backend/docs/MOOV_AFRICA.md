# Moov Africa Mobile Money Integration

Moov Africa (Moov Money) is the mobile money service of Moov Africa telecom in Benin, Togo, Niger, Côte d'Ivoire, Gabon, and other West African countries. This integration uses the **merchant SOAP API** — the same API wrapped by the [PHP SDK](https://github.com/v1p3r75/moov-money-api-php-sdk).

## Merchant Portal & Signup

**There is no public self-service developer portal.** Access requires a merchant/partner agreement with Moov Africa.

### How to Get API Access

1. **Contact Moov Africa** in your country to become a merchant partner:

   | Country | Portal / Contact |
   |---------|------------------|
   | **Benin** | [Devenir Marchand](https://www.moov-africa.bj/devenir-marchand/) |
   | **Togo** | [Marchand Moov Money Flooz](https://moov-africa.tg/moov-money/marchand-moov-money-flooz/) |
   | **Côte d'Ivoire** | [Devenir Partenaire](https://www.moov-africa.ci/devenir-partenaire/) |
   | **Gabon** | [Marchand Partenaires](https://moovmoney.ga/marchand/standards-et-partenaires/) |

2. **Provide required documents** (typical):
   - Commercial register
   - National ID
   - Utility bills / residence certificate
   - Minimum order amount (e.g. 1,000,000 FCFA for distributors)

3. **Receive credentials**:
   - Username
   - Password
   - Encryption key (if different from default)
   - Sandbox vs production URLs

## API Endpoints (from PHP SDK)

| Environment | Base URL |
|-------------|----------|
| **Sandbox** | `https://testapimarchand2.moov-africa.bj:2010/com.tlc.merchant.api/UssdPush` |
| **Production** | `https://apimarchand.moov-africa.bj/com.tlc.merchant.api/UssdPush` |

Other countries (Togo, Niger, etc.) may have different hostnames — use `MOOV_AFRICA_BASE_URL` to override.

## Environment Variables

```env
# Moov Africa Merchant API (Benin, Togo, etc.)
MOOV_AFRICA_USERNAME=your_merchant_username
MOOV_AFRICA_PASSWORD=your_merchant_password

# Optional
MOOV_AFRICA_BASE_URL=https://testapimarchand2.moov-africa.bj:2010/com.tlc.merchant.api/UssdPush
MOOV_AFRICA_ENCRYPTION_KEY=tlc12345tlc12345tlc12345tlc12345
MOOV_AFRICA_SANDBOX=true
```

## Flow

- **Collections (invoice payment)**: `pushWithPendingTransaction` → customer confirms via USSD *555# → poll `getTransactionStatus` for status (no webhook).
- **Disbursements**: `transferFlooz` from merchant wallet to recipient.

## Supported Currencies

- XOF (West African CFA Franc)

## Reference

- [v1p3r75/moov-money-api-php-sdk](https://github.com/v1p3r75/moov-money-api-php-sdk) — PHP SDK this TypeScript port is based on
