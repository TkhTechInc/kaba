# Multi-Business User Support

One user can own multiple **separate** businesses (e.g. "Adama Rice Shop" and "Adama Transport"), not just branches of one org.

## How it works

| Channel | Behavior |
|---------|----------|
| **Web** | BusinessSelector dropdown lists all businesses. Switching updates `defaultBusinessId` in user preferences. |
| **WhatsApp / Telegram** | Uses `defaultBusinessId` when set; else first business. |
| **USSD** | Same as chat. |
| **LINK command** | `LINK email` or `LINK email businessId` to specify which business when linking. |

## API

- `GET /api/v1/access/businesses` — returns businesses with `name` for display.
- `PATCH /api/v1/users/me/preferences` — body `{ defaultBusinessId?: string }`. Validates user has access.

## fix-dev (multi-business)

To add a business without removing others:

```bash
SEED_EMAIL=you@example.com SEED_BUSINESS_ID=demo-adama-rice-shop SEED_KEEP_EXISTING=true npm run fix-dev
```

Without `SEED_KEEP_EXISTING`, fix-dev keeps only the target business (original behavior).

## Manual test

1. User with 2 businesses; set default in app (switch in BusinessSelector).
2. Send WhatsApp message; verify correct business is used.
3. Run `LINK email biz-other` in Telegram; verify that business is linked.
