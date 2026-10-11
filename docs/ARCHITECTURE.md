# Architecture

## Stack

| Layer        | Choice                                                         |
| ------------ | -------------------------------------------------------------- |
| Web Platform | Next.js 15 App Router (React 19, RSC + client islands)         |
| Mobile App   | React Native 0.86 & Expo SDK 57 (Expo Router, TanStack Query)  |
| Language     | TypeScript (strict mode across all packages)                  |
| Styling      | Tailwind CSS (Web) & Zinc/Emerald Design System (Mobile)      |
| Database     | **MongoDB** (native `mongodb` v6 driver with typed accessors)  |
| Auth         | Custom HS256 JWT (HttpOnly cookies for Web, Bearer for Mobile)|
| Validation   | Zod at every route and component boundary                     |
| Tests        | Vitest                                                         |

```
Web (Next.js 15 App Router)         Mobile (Expo SDK 57 / React Native)
     │ (HttpOnly Session Cookie)              │ (Authorization: Bearer <token>)
     └──────────────────────────────┬─────────┘
                                    ▼
                    Route Handlers (/src/app/api/**)
                      │ zod parse · session · RBAC · plan gate
                      ▼
               Services (/src/server/services/*)
                      │
              ┌───────┼─────────┬──────────────┐
              ▼       ▼         ▼              ▼
           MongoDB  Engines   Providers    Queue (in-proc)
          (Native)  scoring/   storage/AI   video analysis
                    elo/matchmaking
```

---

## Directory Map

```text
.
├── docs/                        # Project documentation (API, Architecture, Design)
├── Web/                         # Next.js 15 web platform & unified API backend
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/…            # REST route controllers (thin controllers)
│   │   │   ├── (auth)/…         # login, register, forgot, reset, setup, clubs/new, discover
│   │   │   ├── (app)/app/…      # Authenticated shell: dashboard, members, attendance,
│   │   │   │                    # wallet, penalties, courts, matches, matchmaking,
│   │   │   │                    # leaderboards, tournaments, groups, coaching, videos, settings
│   │   │   ├── admin/           # Platform admin console (KPI pulse & club overview)
│   │   │   └── page.tsx         # Modern landing page
│   │   ├── components/
│   │   │   ├── ui/              # Design system primitives (cards, kit, overlay)
│   │   │   ├── session.tsx      # SessionProvider (user + memberships + active club)
│   │   │   ├── nearby-clubs-bar.tsx # Geolocation nearby clubs explorer
│   │   │   └── auth-forms.tsx   # Login, registration, OTP and onboarding forms
│   │   ├── lib/
│   │   │   ├── api.ts           # Envelope {ok, data|error}, handler(), ApiError, zod helpers
│   │   │   ├── client.ts        # Typed fetch helper with credentials support
│   │   │   ├── constants.ts     # Plans, feature gates, audit actions, defaults
│   │   │   ├── id.ts            # Compact CUID-like document ID generator
│   │   │   └── engines/         # Pure, unit-tested domain logic
│   │   │       ├── scoring.ts   # Badminton set/match validation & score calculator
│   │   │       ├── elo.ts       # Team Elo with margin multiplier & walkover damping
│   │   │       ├── matchmaking.ts # Cost-minimising pairing scheduler
│   │   │       ├── stats.ts     # Player summaries, streaks, pair aggregation
│   │   │       ├── penalty-engine.ts # Fine calculation rules & bucketed summaries
│   │   │       └── attendance-rules.ts # Grace windows, pct math, QR payload codec
│   │   ├── scripts/
│   │   │   └── seed.ts          # MongoDB demo data seeder (clubs, players, matches)
│   │   └── server/
│   │       ├── db.ts            # MongoDB connection singleton & typed collection accessors
│   │       ├── indexes.ts       # MongoDB index declarations (unique, compound, partial)
│   │       ├── auth/            # scrypt password hashing, JWT signing/verifying, sessions
│   │       ├── rbac.ts          # getClubContext, requireStaff, assertFeature…
│   │       ├── providers/       # storage (disk), queue (in-proc), AI (rule-based & mock CV)
│   │       └── services/        # Domain business logic (users, clubs, groups, matches, etc.)
│   └── tests/                   # Vitest integration test suites
│
├── Mobile/                      # Cross-platform Expo SDK 57 mobile application
│   ├── app/
│   │   ├── (auth)/              # login, register, setup screens
│   │   ├── (tabs)/              # index (home), matches, courts, leaderboards, hub, profile
│   │   ├── clubs/               # Club directory & club details screen
│   │   ├── groups/              # PlayGroups directory, group detail, chat feed & sessions
│   │   └── *.tsx                # Attendance, matchmaking, tournaments, penalties, wallet, videos
│   └── src/
│       ├── context/auth.tsx     # Mobile AuthContext with expo-secure-store token persistence
│       ├── lib/api-client.ts    # Typed mobile HTTP client with Bearer auth injection
│       ├── lib/schemas.ts       # Zod schemas for mobile inputs
│       ├── lib/types.ts         # TypeScript models matching backend envelopes
│       └── theme/colors.ts      # Synchronized zinc/emerald mobile palette
└── run.bat                      # Windows launcher for Web & Mobile servers
```

---

## Multi-Tenancy & RBAC

Every club-scoped document carries `clubId`. Access is resolved by `getClubContext(clubId, user)`:

1. **Membership Verification:** Verifies membership document in `clubMembers`; throws `NOT_A_MEMBER` if missing.
2. **Role Hierarchy:** `PLAYER < COACH < ADMIN < OWNER` (plus global platform `SUPER_ADMIN`).
3. **Permission Guards:** `requireStaff` (OWNER/ADMIN), `requireManagerOrCoach` (+COACH), `isStaffOf`, `assertFeature`.

Plan gates are centralised. Calling `assertFeature(club, FEATURES.X)` throws `402 FEATURE_LOCKED` when a club's subscription plan does not allow the feature.

```text
FREE     → Core club ops (members, attendance, wallet, matches, ratings, leaderboards)
           + Community PlayGroups & Nearby Clubs discovery
PRO      → + Penalties ("lassi"), courts/bookings, AI matchmaking engine, tournaments
PREMIUM  → + AI coaching insights, video rally analysis (computer vision)
```

---

## Data Model & MongoDB Storage

The persistence layer uses native MongoDB driver collections. IDs are generated via `cuid()` from `@/lib/id.ts`. Indexes are idempotently created on startup via `ensureIndexes()`.

### Core Collections

- **`users`** — Global user identity (`role=SUPER_ADMIN`, `tokenVersion` for session revocation, `passwordHash`, profile details, `skillLevel`, `playingStyle`, `dominantHand`).
- **`clubs`** — Club entity with coordinates (`lat`, `lng`), slug, subscription tier (`FREE`, `PRO`, `PREMIUM`), and nested `settings` (attendance grace minutes, auto-penalties, booking windows).
- **`clubMembers`** — `(clubId, userId)` compound unique index; stores member `role` (`PLAYER`, `COACH`, `ADMIN`, `OWNER`) and `status` (`ACTIVE`, `PENDING`, `REMOVED`).
- **`attendanceRecords`** — `(clubId, userId, day)` compound unique index; stores attendance state (`PRESENT`, `LATE`, `ABSENT`, `GUEST`, `EXCUSED`), check-in method (`MANUAL`, `QR`, `GPS`, `APP_SELF`), and check-in timestamp.
- **`wallets` & `walletTransactions`** — Append-only ledger in integer paise (₹1 = 100 paise). The wallet stores `balance` and denormalised month totals. Every transaction records `amount`, running `balanceAfter`, and optional links (`reversesId`, `reversedById`).
- **`penaltyRules` & `penalties`** — Fine engine documents. Configurable rules per `eventType` (`LATE`, `ABSENCE`, `LOSS`, `WALKOVER`). Fines can be auto-issued or manually applied; reversals cancel the penalty and append a refund transaction.
- **`courts` & `courtBookings`** — Courts track live status (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`). Bookings prevent slot overlaps via range queries and deduct court fees from player wallets.
- **`matches`, `matchTeams`, `matchPlayers`, `matchScores`** — Badminton matches. Store participants by team index (0 = Team A, 1 = Team B), set scores, live status (`SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), and winner metadata.
- **`playerRatings` & `ratingHistories`** — Per-club Elo rating state (base rating 1200) and chronological match delta logs.
- **`tournaments`, `tournamentParticipants`, `tournamentMatches`** — Knockout brackets stored as `(round, slot)` trees; match winners advance to `round + 1, floor(slot / 2)`.
- **`playGroups`, `playGroupMembers`, `playGroupSessions`, `playGroupSessionRsvps`, `playGroupPosts`** — Social badminton groups: open play session scheduling, venue linking, RSVP attendance tracking (`YES`, `MAYBE`, `NO`), and community messaging feed.
- **`notifications`, `auditLogs`, `otpCodes`, `passwordResetTokens`** — Operational logs, revolving OTP codes with expiry, and audit trails.

---

## Three-Tier Administration Architecture

The platform provides a hierarchical three-tier administration model enforced by the RBAC layer:

### 1. Platform Super Admin (`/admin/…`)
- **Role Guard:** `requireSuperAdmin(user)` (`user.role === "SUPER_ADMIN"`).
- **Surface:** Dedicated admin layout with dark/light mode, global tenant dashboard, user directory, subscription manager, PlayGroup oversight, and immutable cross-tenant audit log.
- **Capabilities:**
  - **Exclusive Club Provisioning:** Only platform Super Admins can register/provision new clubs (`POST /api/clubs`) and assign initial `ownerId`.
  - Assign/revoke Super Admin credentials and suspend malicious users.
  - Switch tenant subscription plans (`FREE` → `PRO` → `PREMIUM`) and soft-delete clubs.
  - Moderate public PlayGroup listings across all cities.
  - Review platform-wide audit log with state diffs and actor tracing.

### 2. Club Admin Cockpit (`/app/admin/…`)
- **Role Guard:** `requireStaff(clubId, user)` (`OWNER` or `ADMIN`).
- **Surface:** Cockpit dashboard embedded inside the club app shell with dedicated sub-navigation.
- **Capabilities & Role Distinction:**
  - **Club Details & Description:** Both club owners and club admins can edit club description, location, contact, and settings (`PATCH /api/clubs/[id]`).
  - **Club Owner Privileges:** Club owner has the exclusive right to appoint club admins (`ADMIN`), players (`PLAYER`), coaches (`COACH`), or transfer ownership (`OWNER`).
  - **Club Admin Limits:** Club admins can reassign regular members between `PLAYER` and `COACH`, but cannot appoint `ADMIN`/`OWNER` or alter the role of existing admins/owners.
  - **Approvals:** Pending member request queue with 1-click approvals and rejections.
  - **Revenue & Dues:** Financial breakdown of wallet inflows/outflows, transaction types, and outstanding fine balances.
  - **Attendance Analytics:** Check-in methods distribution (QR vs GPS vs Manual) and habitual regulars leaderboard.
  - **Member Announcements:** Broadcast notification dispatcher delivering instant alerts to all active club members.
  - **Data Reports:** Client-side CSV generation and export for attendance records, financial ledgers, and rosters.

### 3. PlayGroup Admin Console (`/app/groups/[id]/admin/…`)
- **Creation:** Any registered user can create a PlayGroup (`POST /api/groups`) and becomes the initial group owner/leader (`LEADER`).
- **Role Guard:** `requireGroupLeader(groupId, userId)` for role changes and disbanding; `requireGroupAdminOrLeader` for session management and post moderation.
- **Surface:** Moderation cockpit accessible from the PlayGroup detail header.
- **Capabilities & Role Distinction:**
  - **Group Owner Privileges:** Group owner retains the exclusive authority to change squad roles — appointing Group Admins (`ADMIN`), Players (`MEMBER`), or Co-Leaders (`LEADER`).
  - **Group Admin Capabilities:** Group Admins can schedule sessions, edit squad bio/settings, and moderate posts on the squad wall, but cannot reassign member roles.
  - **Disband Squad:** Only Group Owners can disband or delete the PlayGroup.

## Money & Ledger Invariant

- All financial amounts are **strictly non-zero integer paise** (e.g. ₹150.00 = `15000`).
- Ledger mutations run through `postTransaction()`:
  - Updates member's wallet balance atomically (`$inc`).
  - Appends an immutable `walletTransactions` entry with current timestamp and calculated `balanceAfter`.
- Refunds never edit existing transaction records; they create compensating `REFUND` transactions linked via `reversesId`.

---

## Match Gameplay & Completion Flow

Match progression follows a well-defined lifecycle:

1. **Schedule:** Match is created in `SCHEDULED` status with teams and optional court reservation.
2. **Start:** `POST /clubs/[id]/matches/[matchId]` with `{ action: "start" }` marks match `IN_PROGRESS` and sets court status to `OCCUPIED`.
3. **Live Point Updates:** `{ action: "score", sets: [...] }` updates current game points in real time.
4. **Completion:** `{ action: "complete", sets: [...] }` executes:
   - **Validation:** Enforces official BWF badminton rules (first to 21 with 2-point lead, sudden death cap at 30, best-of-3 sets).
   - **Penalties:** Losers receive configured `LOSS` penalties automatically.
   - **Elo Calculation:** Team-average rating adjustment with margin-of-victory multiplier:
     $$K_{\text{effective}} = K \times \left(1 + \frac{|\text{points}_A - \text{points}_B|}{\text{total points}}\right)$$
     (Walkovers use half $K$ and issue `WALKOVER` penalties).
   - **Rating Persistence:** Updates `playerRatings` and creates `ratingHistories` records.
   - **Court Release:** Sets court back to `AVAILABLE`.
   - **Notifications & Audit:** Sends match outcome alerts to all players.

---

## Matchmaking Engine

The matchmaking algorithm pools checked-in players and pairs them into optimal, fair matches:

1. Players are sorted by fatigue (`matchesToday`), arrival time, and Elo rating.
2. The optimizer evaluates pairings against a weighted penalty function:
   $$\text{cost} = |\overline{R}_A - \overline{R}_B| + 45 \cdot \text{partnerRepetition} + 12 \cdot \text{opponentRepetition} + 0.15 \cdot \text{spread}_{\text{rating}} + 10 \cdot \text{spread}_{\text{fatigue}}$$
3. Preview mode displays predicted matchups and fairness scores; apply mode commits real `SCHEDULED` matches.
4. Supports optional `includeAbsent` and `extraPlayerIds` overrides.

---

## Authentication & Security

- **Web Sessions:** HS256 JWT containing `{ sub, tv, role }` placed in an HttpOnly, SameSite=Lax cookie.
- **Mobile Sessions:** Same JWT issued upon login/token creation, stored in `expo-secure-store`, transmitted via `Authorization: Bearer <token>`.
- **Token Invalidation:** Incrementing `user.tokenVersion` immediately revokes all existing sessions across devices (triggered on password change).
- **Passwords:** Scrypt key derivation with per-user cryptographic salt.
- **Rate Limiting:** IP-based sliding rate limiters on sensitive auth endpoints (`login`, `register`, `otp`, `token`).
- **File Uploads:** MIME-type validation, 5MB image / 100MB video caps, content-type mapping, and path-traversal prevention on `/api/files/*`.

---

## External Service Seams

Third-party dependencies are abstracted behind provider interfaces:

| Provider | Development (Default)             | Production Adapter                 |
| -------- | --------------------------------- | ---------------------------------- |
| Database | Local MongoDB (`mongodb://…`)     | MongoDB Atlas cluster              |
| SMS/OTP  | Mock provider (returns `devCode`) | Twilio / MSG91                     |
| Storage  | Local disk storage (`data/`)      | AWS S3 / Cloudflare R2             |
| AI Coach | Rule-based heuristics             | LLM integration (Gemini / Claude)  |
| Video CV | Synthetic telemetry engine        | Computer Vision court tracking API |

---

## Testing & Verification

Integration tests use Vitest and run against the application services:

```bash
cd Web
npm run test        # Runs Vitest test suites (auth, groups, nearby clubs)
npm run typecheck   # TypeScript compiler validation
npm run db:seed     # Seeds MongoDB database with demo entities
npm run dev         # Launches Next.js dev server on port 3000
```
