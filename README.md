# 🏸 Badminton Club OS

A production-grade, multi-tenant SaaS platform for running badminton clubs — attendance, member
wallets ("lassi" penalties), courts & bookings, match management with Elo ratings, AI matchmaking,
knockout tournaments, leaderboards, AI coaching and video analysis.

Built with **Next.js 15 (App Router) · TypeScript · Tailwind CSS · Prisma · SQLite** (Postgres-ready).

---

## Quick start

```bash
npm install
npx prisma db push        # create prisma/dev.db
npm run db:seed           # demo data (2 clubs, 27 members, 44 matches, a live tournament…)
npm run dev               # http://localhost:3000
```

### Demo accounts (after seeding)

| Role             | Email                 | Password       |
| ---------------- | --------------------- | -------------- |
| Platform admin   | `admin@bcos.app`      | `Admin@123!`   |
| Club owner (PREMIUM club) | `player100@demo.club` | `Password123!` |
| Player           | `player1@demo.club`   | `Password123!` |

OTP login is mocked — the API response includes `devCode` so you can log in without an SMS provider.

## Feature matrix by plan

| Feature                          | FREE | PRO | PREMIUM |
| -------------------------------- | :--: | :-: | :-----: |
| Members, roles, audit log         | ✅  | ✅ |   ✅    |
| Attendance (QR / manual / sweeps) | ✅  | ✅ |   ✅    |
| Wallet ledger & adjustments       | ✅  | ✅ |   ✅    |
| Matches, Elo ratings, stats       | ✅  | ✅ |   ✅    |
| Leaderboards                      | ✅  | ✅ |   ✅    |
| Courts & bookings                 | ❌  | ✅ |   ✅    |
| Penalty rules ("lassi")           | ❌  | ✅ |   ✅    |
| AI matchmaking                    | ❌  | ✅ |   ✅    |
| Tournaments                       | ❌  | ✅ |   ✅    |
| Rule-based AI coaching            | ❌  | ❌ |   ✅    |
| Video analysis (mock CV)          | ❌  | ❌ |   ✅    |

Plans are enforced server-side (`assertFeature`) on every gated route; the `/admin` page lets a
super admin flip any club between FREE / PRO / PREMIUM instantly.

## What's inside

- **Auth** — email+password (scrypt), mobile OTP (mocked), Google (mocked), JWT session cookies with
  `tokenVersion` revocation.
- **Attendance** — daily QR tokens, GPS check-in validation, late/absence rules, one-click daily
  sweep that marks absentees and issues penalties automatically.
- **Wallet** — append-only ledger (paise integers), opening credits, staff adjustments, refunds that
  reverse original transactions, per-member balances and monthly summaries.
- **Penalties** — configurable per-event rules, auto-issuance from matches/sweeps, manual issues and
  reversals, monthly summaries.
- **Courts & bookings** — live court board (OCCUPIED while matches run), hourly fee estimates,
  conflict-checked bookings, wallet debits on booking.
- **Matches** — schedule → start → set-by-set scoring with badminton rule validation (≥21, +2 lead,
  30-cap at 29-29), walkovers, cancellation, full audit trail.
- **Ratings** — team-average Elo with margin-of-victory multiplier, walkover damping, rating history
  per player per match.
- **Matchmaking** — checked-in queue → cost-minimising doubles pairing (rating balance, partner /
  opponent repetition, fatigue fairness) → apply to create scheduled matches.
- **Tournaments** — single-elimination brackets (4/8/16/32) with standard seeding, score entry
  advances winners, automatic champion notification.
- **Analytics** — club dashboard KPIs, per-player statistics (form, streaks, partners, head-to-head),
  category leaderboards across periods.
- **AI extras** — cached coaching insights (rule-based engine, provider-swappable) and mock
  computer-vision video analysis pipeline with queue worker.

## Scripts

| Command             | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Start dev server                         |
| `npm run build`     | Production build (`prisma generate` + next build) |
| `npm run test`      | Vitest suite (engines + wallet ledger)   |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm run db:push`   | Sync Prisma schema to SQLite             |
| `npm run db:seed`   | Reset + seed demo data                   |
| `npm run db:studio` | Browse the database                      |

## Docs

- [`docs/API.md`](docs/API.md) — every REST endpoint with auth requirements.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system design, data model, engines, security.

## Switching to Postgres

1. Change the `datasource provider` in `prisma/schema.prisma` to `"postgresql"`.
2. Point `DATABASE_URL` at your Postgres instance.
3. `npx prisma db push && npm run db:seed`.

All queries use standard Prisma APIs (no SQLite-specific raw SQL), so nothing else changes.
