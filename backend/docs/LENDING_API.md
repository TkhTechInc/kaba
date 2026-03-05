# Lending-as-a-Service API

Banks and lending partners can use the Loan Readiness API to assess MSME creditworthiness. Authenticate with an API key that has the `lending:read` scope.

## Endpoint

```
POST /api/v1/ai/loan-readiness
```

## Authentication

Include the API key in the `Authorization` header:

```
Authorization: Bearer qb_live_xxxxxxxxxxxx
```

The API key must have the `lending:read` scope and be scoped to the business you are querying.

## Request

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| businessId | string | Yes | Business ID to assess |
| fromDate | string | Yes | Start date (YYYY-MM-DD) |
| toDate | string | Yes | End date (YYYY-MM-DD) |

## Response

```json
{
  "success": true,
  "data": {
    "score": 4,
    "maxScore": 5,
    "suggestions": [
      "Improve daily transaction consistency",
      "Consider adding more sales days per week"
    ],
    "summary": {
      "transactionCount": 45,
      "avgDailyRevenue": 12500,
      "consistencyScore": 72,
      "hasPositiveTrend": true
    }
  }
}
```

## Example

```bash
curl -X POST "https://api.example.com/api/v1/ai/loan-readiness" \
  -H "Authorization: Bearer qb_live_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"businessId":"biz_123","fromDate":"2025-01-01","toDate":"2025-01-31"}'
```
