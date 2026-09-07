# Architecture

## Stack

| Layer      | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 15 App Router (React 19, RSC + client islands) |
| Language   | TypeScript (strict)                           |
| Styling    | Tailwind CSS with a shadcn-style token system |
| Database   | SQLite via Prisma (Postgres-ready)            |
| Auth       | Custom HS256 JWT in HttpOnly cookies          |
| Validation | Zod at every route boundary                   |
| Tests      | Vitest                                        |

```
Browser ──▶ Route Handlers (/src/app/api/**)
                │  zod parse · session · RBAC · plan gate
                ▼
         Services (/src/server/services/*)        ◀── business rules live here
                │
        ┌───────┼─────────┬──────────────┐
        ▼       ▼         ▼              ▼
     Prisma  Engines    Providers    Queue (in-proc)
    (SQLite) /lib/engines  storage/AI  video analysis
```

## Directory map

```
src/
├─ app/
│  ├─ api/…                  # REST route handlers (thin controllers)
│  ├─ (auth)/…               # login/register/forgot/reset/clubs/new/discover
│  ├─ (app)/app/…            # authenticated shell: dashboard, members, attendance,
│  │                         # wallet, penalties, courts, matches, matchmaking,
│  │                         # leaderboards, tournaments, coaching, videos, settings
│  ├─ admin/                 # platform admin console
│  └─ page.tsx               # marketing landing
├─ components/
│  ├─ ui/                    # design system: card/kit/overlay primitives
│  ├─ session.tsx            # SessionProvider (me + memberships + active club)
│  └─ auth-forms.tsx
├─ lib/
│  ├─ api.ts                 # envelope {ok,data|error}, handler(), ApiError, zod helpers
│  ├─ client.ts              # typed fetch helper for the browser
│  ├─ constants.ts           # plans, features, audit actions
│  └─ engines/               # pure, unit-tested domain logic
│     ├─ scoring.ts          # badminton set/match validation, RNG set generator
│     ├─ elo.ts              # team Elo w/ margin multiplier + provider registry
│     ├─ matchmaking.ts      # cost-minimising pairing scheduler
│     ├─ stats.ts            # player summaries, streaks, pair aggregation
│     ├─ penalty-engine.ts   # rule matching + time-bucketed summaries
│     └─ attendance-rules.ts # grace windows, pct math, QR payload codec
└─ server/
   ├─ db.ts                  # Prisma singleton (+ Tx type = client or transaction)
   ├─ auth/                  # password scrypt, JWT tokens, cookie session
   ├─ rbac.ts                # getClubContext, requireStaff, assertFeature…
   ├─ providers/             # storage (local disk), queue (in-process), AI (rulebased/mock-CV)
   └─ services/              # one module per aggregate — all business logic
```

## Multi-tenancy & RBAC

Every club-scoped row carries `clubId`. Access is resolved by `getClubContext(clubId, user)`:

1. Load membership → throw `NOT_A_MEMBER` if absent.
2. Role ladder: `PLAYER < COACH < ADMIN < OWNER` (plus platform `SUPER_ADMIN`).
3. Helpers: `requireStaff` (OWNER/ADMIN), `requireManagerOrCoach` (+COACH),
   `isStaffOf`, `assertFeature`.

Plan gates are explicit and centralised. `assertFeature(club, FEATURES.X)` throws
`402 FEATURE_LOCKED`; the UI renders an upsell state when it catches that code.

```
FREE     → core club ops (members, attendance, wallet, matches, ratings, leaderboards)
PRO      → + penalties, courts/bookings, matchmaking, tournaments
PREMIUM  → + AI coaching, video analysis
```

## Data model highlights

- **User** — global identity (`role=SUPER_ADMIN`, `tokenVersion` for session revocation).
- **ClubMember** — `(clubId,userId)` unique; `role`, `status` (ACTIVE/PENDING/REMOVED).
- **AttendanceRecord** — `(clubId,userId,day)` unique; status PRESENT/LATE/ABSENT/GUEST/EXCUSED.
- **Wallet / WalletTransaction** — append-only ledger in integer paise; running `balanceAfter`;
  reversals via `reversesId`/`reversedById` links; wallet holds denormalised totals for fast reads.
- **PenaltyRule / Penalty** — configurable per-event fines; auto-issued from sweeps and matches;
  reversal flips status and writes a REFUND transaction.
- **Court / CourtBooking** — conflict-checked time ranges; fee debited from wallet on confirm.
- **Match → MatchTeam → MatchPlayer**, scores in **MatchScore** rows; `status`
  SCHEDULED→IN_PROGRESS→COMPLETED/WALKOVER/CANCELLED.
- **PlayerRating / RatingHistory** — per-club Elo state plus full delta history per match.
- **Tournament → TournamentParticipant / TournamentMatch** — knockout bracket stored as
  `(round, slot)` grid; winners advance to `round+1, floor(slot/2)`.
- **Notification / AuditLog / OtpCode / PasswordResetToken** — operational side tables.

## Money rules

- All amounts are **integer paise**; zod enforces non-zero integers on adjustments.
- Wallet mutations always run through `postTransaction(tx, …)` inside a transaction — balance,
  totals and the ledger row can never diverge.
- Refunds/reversals never mutate original rows' amounts; they append compensating entries.

## Match completion transaction

`completeMatch` wraps everything in a single interactive transaction (30s timeout for slow disks):

score replace → LOSS/WALKOVER penalty per loser (rule engine) → team-average Elo with
margin-of-victory multiplier (walkovers halve K) → PlayerRating upserts + RatingHistory rows →
match status update. Notifications and audit logs are written after commit so failures there can't
roll back gameplay.

Badminton scoring is validated by the pure engine before any DB work:
win at ≥21 with a 2-point lead, hard cap of 30 only at 29-29, best-of-3 with no dead sets.

## Matchmaking engine

Checked-in players are sorted by fatigue (`matchesToday`) then check-in time then rating. For each
court the engine searches windows of players and all 4-player pairings, minimising:

```
cost = |avg(ratingA) − avg(ratingB)|
     + 45 × partnerRepetition   (from partnerHistory)
     + 12 × opponentRepetition  (from opponentHistory)
     + 0.15 × ratingSpread + 10 × fatigueSpread
```

Preview is free; applying creates real scheduled matches. Leftovers stay in the queue.

## Auth & security

- Passwords: scrypt with random salt; OTPs hashed at rest with attempt counters and expiry.
- Sessions: HS256 JWT carrying `{ sub, tv }`; `tokenVersion` bump invalidates existing tokens
  (used on password change). Cookies are HttpOnly + SameSite=Lax.
- Every route validates input with Zod (`parseBody`/`parseQuery` return fully-typed output).
- Uploads: MIME allow-list, size caps, generated storage keys; `/files/*` guards against path
  traversal and serves a fixed content-type map.
- Audit log records actor, entity and previous/new values for sensitive operations.

## External-service seams

Everything third-party sits behind a provider interface in `server/providers/`:

| Provider | Today (mock)                       | Production swap                     |
| -------- | ---------------------------------- | ----------------------------------- |
| SMS      | OTP returned as `devCode`          | Twilio/MSG91 in `otp.request`       |
| Google   | Synthetic identity from email      | Real OAuth callback verification    |
| Storage  | Local `data/uploads` + `/files/*`  | S3/R2 (`put`/`signedUrl`)           |
| Queue    | In-process setTimeout worker       | BullMQ/QStash worker                |
| AI/CV    | Rule-based coach, mock CV metrics  | LLM endpoint + real vision service  |
| Payments | Plan flips are instant             | Razorpay webhooks → changePlan      |

Swapping providers requires no changes to services or engines.

## Testing strategy

`tests/` covers the pure engines (scoring validity incl. deuce edge cases, Elo zero-sum/walkover
damping, matchmaking fairness constraints, streak/stats math, penalty buckets) plus an integration
test that copies the dev database and exercises the real wallet ledger: credits/debits, isolation,
refund-once semantics and the ledger invariant over a randomised op sequence.

```bash
npm run test        # vitest run
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

## Scaling path

1. **SQLite → Postgres**: switch provider, `db push` — no raw SQL anywhere.
2. **Queue → Redis-backed workers**: move video analysis out of process.
3. **Storage → S3**: signed uploads direct from browser.
4. **Realtime**: replace polling (Bell, live matches) with SSE/WebSocket channel per club.
5. **Payments**: webhook-driven plan changes + wallet top-ups.
