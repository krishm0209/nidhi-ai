@AGENTS.md

# NidhiAI — Version 1.0

**Deployed:** March 2026
**URL:** https://nidhi-ai-iota.vercel.app
**Stack:** Next.js (App Router), Supabase, Upstash Redis, Tailwind CSS, Vercel

---

## What's in V1

- **Auth:** Email/password + Google OAuth, onboarding flow (name, DOB, risk profile)
- **Holdings:** Stocks (NSE/BSE via Groww API), Mutual Funds (CAS import + manual), Crypto, Fixed Income, Gold
- **Dashboard:** Net worth, P&L, day change, allocation pie, SIP reminder banner
- **AI Advisor:** Gemini-powered chat with portfolio context
- **Tax:** Capital gains (STCG/LTCG), 80C optimizer, ITR guide with portal field mappings
- **Tools:** Portfolio X-ray, MF overlap, SIP tracker, What-If simulator, Benchmark, Year Wrapped
- **Family:** Household members management
- **Import:** CAS PDF parser (CAMS/KFintech)
- **Settings:** Profile edit, password change, account deletion
- **Admin:** Manual Groww token update (krish.makhija2@gmail.com only)
- **Mobile:** Bottom nav, responsive forms

---

## Key Architecture Decisions

- `proxy.ts` handles session refresh (NOT `middleware.ts` — deleted, causes conflicts)
- Groww access token: manually updated daily via `/admin` → stored in Redis with TTL until 6 AM IST
- Onboarding uses `/api/onboarding` route with service role key to bypass RLS recursion on `households`
- Google OAuth uses client-side `signInWithOAuth` (server actions can't redirect to external URLs on Vercel)
- Account deletion uses service role to delete all data + auth user

---

## Env Vars Required

| Key | Purpose |
|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations |
| `GROWW_API_KEY` | Long-lived Groww JWT |
| `GROWW_ACCESS_TOKEN` | Daily access token (fallback if Redis empty) |
| `GEMINI_API_KEY` | AI advisor |
| `UPSTASH_REDIS_REST_URL` | Redis cache |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth |
| `RESEND_API_KEY` | Email |
| `CRON_SECRET` | Protects cron endpoints |
| `ADMIN_EMAIL` | Only this email can access /admin |
| `NEXT_PUBLIC_APP_URL` | Full app URL (used in OAuth redirects) |
| `ENCRYPTION_KEY` | Data encryption |

---

## Cron Jobs (cron-job.org)

| URL | Schedule | Purpose |
|-----|----------|---------|
| `/api/cron/groww-token` | `5 0 * * *` UTC | Rotate Groww token daily |
| `/api/cron/prices` | `*/5 3-10 * * 1-5` UTC | Stock price refresh (market hours) |
| `/api/cron/monthly-reset` | `0 0 1 * *` UTC | Monthly reset |

All crons require `Authorization: Bearer <CRON_SECRET>` header.

---

## Supabase Migration Required

```sql
alter table profiles add column if not exists last_cas_import_at timestamptz;
```
