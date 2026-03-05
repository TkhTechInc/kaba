# QuickBooks West Africa — Stabilization Status

**Goal:** Freeze feature development and ensure the project builds, runs, and is ready for testing/deployment.

---

## ✅ Completed (Stabilization Pass)

| Item | Status |
|------|--------|
| Backend TypeScript build | ✅ Passes |
| Backend type-check | ✅ Passes |
| Stripe package | ✅ Installed (`stripe`) |
| `LedgerRepository.listAllByBusinessForBalance` | ✅ Returns `category` and `currency` for AI/reports |
| Payment routing | ✅ Country-based (not currency) |

---

## Scripts

```bash
# Backend
cd backend
npm run build
npm run type-check
npm run dev

# Frontend
cd frontend
npm run build
npm run dev
```

---

## Known Limitations (No New Features)

- **Backend lint:** `npm run lint` requires `eslint` in devDependencies (not installed).
- **Tests:** No Jest tests yet.
- **CDK deploy:** Not verified in this pass.

---

## Before Adding Features

1. Run `npm run build` in backend and frontend.
2. Ensure `.env` is configured (see `backend/.env.example`).
3. Run `npm run dev` in backend.

---

*Last updated: stabilization pass*
