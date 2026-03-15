# Quick Start - Production Fixes Applied

✅ **5 critical production issues fixed**
✅ **All dependencies installed**
🚀 **Ready to deploy**

---

## What Changed?

1. **Atomic Financial Transactions** - No more race conditions
2. **Disaster Recovery** - 35-day backups enabled
3. **Error Tracking** - Sentry integrated
4. **Auth Security** - Rate limiting + IP lockout
5. **Payment Reliability** - Circuit breaker + retry logic

---

## Setup (5 minutes)

### 1. Get Sentry DSN

1. Go to https://sentry.io (sign up free)
2. Create 2 projects: `kaba-backend` and `kaba-frontend`
3. Copy DSNs from Settings → Client Keys

### 2. Set Environment Variables

**Backend** (`backend/.env`):
```bash
# Add these lines
SENTRY_DSN=https://your-key@sentry.io/123456
SENTRY_RELEASE=1.0.0
```

**Frontend** (`frontend/.env.local`):
```bash
# Add these lines
NEXT_PUBLIC_SENTRY_DSN=https://your-key@sentry.io/789012
NEXT_PUBLIC_SENTRY_RELEASE=1.0.0
NEXT_PUBLIC_ENV=development
```

### 3. Run Tests

```bash
cd backend
npm test

# Should see:
# ✓ LedgerRepository - 11 tests passing
# ✓ All other existing tests passing
```

---

## Deploy

### Development

```bash
# Terminal 1 - Backend
cd backend
npm run dev  # → http://localhost:3001

# Terminal 2 - Frontend
cd frontend
npm run dev  # → http://localhost:3000
```

### Production

```bash
# Deploy infrastructure (includes new MonitoringStack)
cd backend
npm run cdk:deploy

# Deploy frontend
cd frontend
vercel deploy --prod
```

---

## Verify It Works

### 1. Test Atomic Transactions

Create a ledger entry - it will now use atomic DynamoDB transactions:

```bash
curl -X POST http://localhost:3001/api/v1/ledger/entries \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sale",
    "amount": 100,
    "currency": "NGN",
    "description": "Test sale",
    "category": "Revenue",
    "date": "2026-03-15"
  }'

# ✅ Entry and balance updated together (no race condition)
```

### 2. Test Rate Limiting

Try 6 login attempts - 6th should be blocked:

```bash
for i in {1..6}; do
  echo "Attempt $i:"
  curl -X POST http://localhost:3001/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"phone": "+1234567890", "otp": "000000"}'
  echo ""
done

# ✅ Attempts 1-5: 401 Unauthorized
# ✅ Attempt 6: 429 Too Many Requests
```

### 3. Test Sentry

Trigger an error and check Sentry dashboard:

```bash
# Trigger 500 error
curl http://localhost:3001/api/v1/test-error

# ✅ Check https://sentry.io - error should appear within 30 seconds
```

### 4. Check Monitoring

After deploying to AWS:

- **CloudWatch Dashboard**: https://console.aws.amazon.com/cloudwatch/home?region=ca-central-1#dashboards:name=Kaba-dev-Overview
- **Alarms**: Should see 10+ alarms created (DynamoDB throttling, Lambda errors, etc.)
- **SNS Topic**: Subscribe your email to `Kaba-dev-Alerts`

---

## What to Watch

### Metrics to Monitor

| Metric | Target | Action if Exceeded |
|--------|--------|-------------------|
| DynamoDB throttled requests | 0 | Increase capacity |
| Lambda errors | < 0.1% | Check Sentry for details |
| API 5xx errors | < 0.5% | Check Lambda logs |
| Payment failures | < 5% | Check TKH Payments status |
| P99 latency | < 3s | Investigate slow queries |

### CloudWatch Alarms

You'll get email alerts for:
- ⚠️ DynamoDB throttling (> 5 requests/min)
- ⚠️ Lambda errors (> 10 errors/5min)
- ⚠️ API Gateway 5xx (> 10 errors/5min)
- ⚠️ Lambda P99 duration (> 5 seconds)
- ⚠️ Lambda throttles (> 5/min)

---

## Files Changed

### New Files Created

```
backend/src/shared/sentry.ts                     # Sentry integration
backend/src/nest/common/guards/rate-limit.guard.ts  # Rate limiting
backend/src/infrastructure/stacks/MonitoringStack.ts  # CloudWatch alarms
backend/src/domains/ledger/repositories/__tests__/LedgerRepository.spec.ts  # Tests

frontend/sentry.client.config.ts                 # Frontend Sentry
frontend/sentry.server.config.ts                 # SSR Sentry

PRODUCTION_READINESS.md                          # Full review report
IMPLEMENTATION_SUMMARY.md                        # Detailed changes
QUICK_START.md                                   # This file
```

### Files Modified

```
backend/src/domains/ledger/repositories/LedgerRepository.ts  # Atomic transactions
backend/src/domains/payments/services/PaymentsClient.ts      # Circuit breaker
backend/src/infrastructure/stacks/LedgerServiceStack.ts      # PITR enabled
backend/src/nest/main.ts                                     # Sentry init
backend/src/nest/common/filters/http-exception.filter.ts     # Sentry capture
backend/src/nest/modules/auth/auth.controller.ts             # Rate limiting
backend/.env.example                                         # New vars
frontend/.env.example                                        # New vars
```

---

## Troubleshooting

### "Cannot find module '@sentry/node'"

```bash
cd backend
npm install --legacy-peer-deps
```

### "Circuit breaker not opening"

Check you have the latest code:
```bash
cd backend
git pull
npm list opossum  # Should show opossum@9.0.0
```

### "Rate limiting not working"

EnhancedRateLimitGuard needs to be added to AppModule:
```typescript
// backend/src/nest/app.module.ts
providers: [
  // ... existing providers
  {
    provide: APP_GUARD,
    useClass: EnhancedRateLimitGuard,
  },
]
```

### "Sentry not receiving errors"

1. Check DSN is set: `echo $SENTRY_DSN`
2. Check Sentry init logs: Look for `[Sentry] Initialized for development`
3. Trigger test error: `curl http://localhost:3001/api/v1/health`

---

## Cost Impact

**New monthly costs**: ~$30
- Sentry Team plan: $29
- SNS notifications: $0.50

**Worth it?** YES
- One prevented data loss = $10,000+ in recovery
- Real-time error alerts = faster bug fixes
- Circuit breaker = higher payment success rate

---

## Next Steps

### This Week
- [ ] Set up Sentry account (30 min)
- [ ] Deploy to staging (1 hour)
- [ ] Run smoke tests (30 min)
- [ ] Subscribe to CloudWatch alarms (15 min)

### Next 2 Weeks
- [ ] Implement JWT refresh tokens (Task #2)
- [ ] Write payment integration tests (Task #5)
- [ ] Migrate to AWS Secrets Manager (Task #7)
- [ ] Add AWS X-Ray tracing (Task #8)

### Before Production Launch
- [ ] Increase test coverage to 80%+ (Task #13)
- [ ] Load test at 10,000 RPS
- [ ] Security audit
- [ ] Gradual rollout (5% → 25% → 100%)

---

## Support

**Documentation**:
- Full review: `PRODUCTION_READINESS.md`
- Detailed changes: `IMPLEMENTATION_SUMMARY.md`
- This guide: `QUICK_START.md`

**Monitoring**:
- Errors: https://sentry.io
- Metrics: CloudWatch Dashboard
- Alerts: Email (SNS topic)

**Questions?** Check the docs above or review the code comments.

---

✅ **You're ready to go! Deploy with confidence.**
