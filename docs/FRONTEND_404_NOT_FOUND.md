# Frontend 404 / Not Found Handling

## Overview

Several dynamic routes handle "not found" cases **in-page** rather than via Next.js `not-found.tsx`. This avoids duplication and provides context-specific messaging.

## Routes That Handle 404 Internally

| Route | Behavior |
|-------|----------|
| `invoices/[id]` | Shows "Invoice not found" with link back to invoices when API returns error or null |
| `invoices/[id]/edit` | Shows error message or "This invoice cannot be edited" with link back |
| `store/[slug]` | Shows "Business not found" when storefront API returns 404 or invalid slug |
| `portal/[businessId]` | Shows "Invalid portal link" when businessId is missing or invalid |

**Do not** add `not-found.tsx` to these route segments—it would duplicate the in-page handling and create inconsistent UX.

## Global 404

- `app/not-found.tsx` – Root-level 404 for unknown routes
- `app/(home)/not-found.tsx` – 404 within the home layout (if needed)
