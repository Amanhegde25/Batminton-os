# REST API Reference

Base URL: `/api` · Content type: `application/json` (except multipart uploads)

Every response uses a consistent envelope:

```jsonc
// success
{ "ok": true, "data": { /* … */ } }

// error
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "Not a member of this club" } }
```

**Error codes:** `VALIDATION` · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) ·
`CONFLICT` (409) · `FEATURE_LOCKED` (402, plan gate) · `RATE_LIMITED` (429) · `INTERNAL` (500).

### Authentication

The platform supports two authentication transports:
1. **Web App (Cookie):** HttpOnly JWT session cookie (`bcos_session`). Browser requests include credentials automatically via `fetch(…, { credentials: "include" })` (default in the web app's `api()` helper).
2. **Mobile & External Clients (Bearer Token):** JWT token sent via `Authorization: Bearer <token>` header. Tokens are obtained from `POST /api/auth/token` or `POST /api/auth/login`.

---

## Auth

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/auth/register` | – | `{ name, email?, mobile?, password, dob?, gender? }` (requires email or mobile) → creates user + session |
| POST | `/auth/login` | – | `{ identifier? \| email? \| mobile?, password }` → session cookie + `{ user, token }` |
| POST | `/auth/token` | – | `{ email, password }` → returns `{ user, token }` for mobile/bearer auth |
| GET | `/auth/token` | ✅ | Validates bearer token from `Authorization` header → returns `{ user }` |
| POST | `/auth/logout` | – | Clears `bcos_session` cookie → `{ loggedOut: true }` |
| POST | `/auth/otp/request` | – | `{ mobile }` → mock OTP; response includes `devCode` |
| POST | `/auth/otp/verify` | – | `{ mobile, code }` → creates/logs in user + session cookie + `{ user }` |
| POST | `/auth/google/callback` | – | Mock Google sign-in → session |
| POST | `/auth/forgot` | – | `{ email }` → password reset path (mock: returned as `devResetPath`) |
| POST | `/auth/reset` | – | `{ token, newPassword }` → resets password |
| POST | `/auth/change-password` | ✅ | `{ currentPassword \| null, newPassword }`; revokes all other sessions |

## Users

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/users/me` | ✅ | Profile + club memberships + active context |
| PATCH | `/users/me` | ✅ | Update profile fields (`name`, `email`, `mobile`, `aadhar`, `photoUrl`, `dob`, `gender`, `skillLevel`, `playingStyle`, `dominantHand`, `preferredTime`) |
| POST | `/users/setup` | ✅ | Onboarding completion `{ email?, mobile?, aadhar?, skip? }` → saves profile + updates session |

## Clubs

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs` | – | Directory & nearby search: `?q=&city=&lat=&lng=&excludeClubId=`. Computes distance when coordinates provided |
| POST | `/clubs` | SUPER_ADMIN | Provision club tenant (can assign initial `ownerId`) — `{ name, description?, city?, address?, logoUrl?, lat?, lng?, ownerId? }` |
| GET | `/clubs/[id]` | – | Public club profile, subscription plan, features, member/court/match counts |
| PATCH | `/clubs/[id]` | Staff | Update details (name, description, city, etc.) and `settings` (`attendance`, `booking`, `membership`, `matchmaking`) |
| POST | `/clubs/[id]/join` | ✅ | Request membership `{ message? }` |

### Club Settings Configuration Shape

Configured via `PATCH /clubs/[id]` under the `settings` object:
```jsonc
{
  "attendance": {
    "startMinutes": 360,          // Minutes from midnight (e.g. 06:00 AM)
    "graceMinutes": 30,           // Lateness grace window
    "gpsRequired": false,         // Enforce GPS coordinates on check-in
    "gpsRadiusMeters": 200,       // Allowed check-in radius from club lat/lng
    "selfCheckIn": true,          // Allow player app self check-in
    "autoAbsentPenalty": true,    // Run-daily sweep issues ABSENCE fine
    "minAttendancePct": 75        // Minimum attendance threshold
  },
  "booking": {
    "cancellationWindowMinutes": 120
  },
  "membership": {
    "monthlyFee": 150000,         // In paise (₹1,500)
    "autoApprove": false
  },
  "matchmaking": {
    "allowAbsent": false          // Include absent checked-in players
  }
}
```

## PlayGroups (Open Community)

PlayGroups enable local open badminton communities, social play sessions, RSVP rosters, and group discussion feeds.

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/groups` | ✅ | Browse groups: `?city=&q=&myOnly=true\|false` |
| POST | `/groups` | ✅ | Create group `{ name, description?, city?, skillLevel?, isPublic?, logoUrl? }` (creator becomes LEADER) |
| GET | `/groups/[id]` | ✅ | Group details, member count, upcoming session count, user's membership role |
| DELETE | `/groups/[id]` | Leader | Soft delete playgroup |
| POST | `/groups/[id]/members` | ✅ | Join group (creates ACTIVE membership) |
| DELETE | `/groups/[id]/members` | ✅ | Leave group |
| GET | `/groups/[id]/posts` | ✅ | Group community feed (latest 50 messages with author profiles) |
| POST | `/groups/[id]/posts` | ✅ | Post message to group feed `{ content }` |
| GET | `/groups/[id]/sessions` | ✅ | List scheduled play sessions with venue info & player RSVPs |
| POST | `/groups/[id]/sessions` | ✅ | Schedule play session `{ title, clubId?, clubName?, clubAddress?, scheduledDate, durationMinutes?, maxPlayers?, costPerPlayer?, notes? }` |
| POST | `/groups/[id]/sessions/[sessionId]/rsvp` | ✅ | RSVP to a session `{ status: "YES" \| "MAYBE" \| "NO" }` |

## Members (Staff)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/members` | Member | `?status=ACTIVE\|PENDING\|REMOVED` list with roles, wallets, and ratings |
| POST | `/clubs/[id]/members` | Staff | Add member directly `{ userId? \| email+name, role? }` |
| PATCH | `/clubs/[id]/members`* | Staff | Change role / approve / reject / remove. Club Owner can assign any role (`OWNER`, `ADMIN`, `COACH`, `PLAYER`). Club Admin can only reassign between `PLAYER` and `COACH` (cannot assign or alter `ADMIN`/`OWNER`). |

\* Passed via body `memberId` or URL param.

## Attendance

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/attendance` | Member | `?date=YYYY-MM-DD` (daily roster) · `view=month&month=YYYY-MM` (grid matrix) · `view=history&userId=` (personal attendance records) |
| POST | `/clubs/[id]/attendance` | Member/Staff | Unified attendance: staff manual marking (`{ userId, status, day?, note? }`) or player self check-in |
| POST | `/clubs/[id]/attendance/checkin` | Member | `{ method: "MANUAL"\|"QR"\|"GPS"\|"APP_SELF", token?, lat?, lng?, userId?, status? }` → marks PRESENT/LATE/GUEST |
| GET | `/clubs/[id]/attendance/qr` | Staff | Today's revolving QR token `{ token, expiresInSec, day }` |
| POST | `/clubs/[id]/attendance/run-daily` | Staff | Daily sweep: marks absentees and issues configured ABSENCE penalties |

## Wallet

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/wallet` | Member | Own wallet balance, monthly credit/debit totals, dues, recent transactions |
| GET | `/clubs/[id]/wallet/transactions` | Member | Own transactions list. Staff: `?userId=&type=&page=` · `?view=balances` (all member balances) |
| POST | `/clubs/[id]/wallet/transactions` | Staff | Manual adjustment `{ userId, amount±, description }` (integer paise) |
| POST | `/clubs/[id]/wallet/refund` | Staff | Reverse an existing transaction `{ transactionId, reason? }` |

All amounts are integer paise (₹1 = 100 paise). The ledger is append-only; refunds create `REFUND` entries and link to the reversed row.

## Penalties ("lassi")

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/penalties` | Member | Own penalty ledger + summary. Staff: `?userId=` anyone, `?view=summary` club totals |
| POST | `/clubs/[id]/penalties` | Staff | Manual penalty issue `{ userId, eventType, label?, amount?, reason? }` |
| GET/POST/DELETE | `/clubs/[id]/penalties/rules` | Staff | CRUD fine rules per eventType (`DELETE ?ruleId=`) |
| POST | `/clubs/[id]/penalties/reverse` | Staff | Reverse penalty `{ penaltyId, reason? }` (cancels fine & writes REFUND wallet txn) |

Auto-issued events: `LATE`, `ABSENCE`, `LOSS`, `WALKOVER`.

## Courts & Bookings (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/courts` | Member | List courts with live status (`AVAILABLE`, `OCCUPIED`, `MAINTENANCE`) |
| POST/PATCH | `/clubs/[id]/courts` | Staff | Add court / edit name, fee, status (enforces plan court limit) |
| GET | `/clubs/[id]/bookings` | Member | `view=mine` (user's bookings) · staff board `?date=YYYY-MM-DD` |
| POST | `/clubs/[id]/bookings` | Member | `{ courtId, startTime, endTime, forUserId?(staff), notes? }` — conflict checked, wallet debited |
| DELETE | `/clubs/[id]/bookings?bookingId=` | Owner/Staff | Cancel booking (fee automatically refunded to wallet) |

## Matches, Live Scoring & Ratings

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/matches` | Member | `status=SCHEDULED,IN_PROGRESS,COMPLETED&userId=&day=&page=` |
| POST | `/clubs/[id]/matches` | Staff | `{ type: "SINGLES"\|"DOUBLES", teamAUserIds, teamBUserIds, courtId?, scheduledAt?, notes? }` |
| GET | `/clubs/[id]/matches/[matchId]`* | Member | Full match detail: teams, set scores, court, live status, rating changes |
| POST | `/clubs/[id]/matches/[matchId]`* | Staff | Actions: `start` · `score` · `complete` · `walkover` · `cancel` (see details below) |
| PATCH | `/clubs/[id]/matches/[matchId]` | Staff | Edit teams, court, schedule, notes before match completion |
| GET | `/clubs/[id]/players/[userId]/rating` | Member | Per-club Elo rating card + historical delta timeline |

\* The `[id]` parameter in match routes can be specified as `_` for auto-resolution from the match record.

### Match Actions (`POST /clubs/[id]/matches/[matchId]`)

- **`{ action: "start" }`** — Transitions match from `SCHEDULED` → `IN_PROGRESS` and stamps `startedAt`.
- **`{ action: "score", sets: [{ a, b }] }`** — Real-time game points update. Saves ongoing point scores (up to 3 sets) without ending the match.
- **`{ action: "complete", sets?: [{ a, b }] }`** — Finalises match: validates badminton rules (≥21 with 2-point lead, max 30 at 29-29, best-of-3), calculates team-average Elo deltas with margin multiplier, issues `LOSS` penalties, frees court (`AVAILABLE`), and dispatches notifications.
- **`{ action: "walkover", winnerTeamIndex: 0 | 1 }`** — Concludes match by walkover, halves K-factor, and issues `WALKOVER` penalty to conceding team.
- **`{ action: "cancel" }`** — Marks match `CANCELLED`, frees court, and audits cancellation.

## Matchmaking (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/matchmaking/generate` | Gate MATCHMAKING | Preview optimal pairings: `?mode=SINGLES\|DOUBLES&includeAbsent=true\|false&extraPlayerIds=id1,id2` |
| POST | `/clubs/[id]/matchmaking/generate` | Gate | Preview or create scheduled matches: `{ apply: true\|false, mode, includeAbsent?, extraPlayerIds? }` |

## Tournaments (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/tournaments` | Member | List tournaments with participant counts and status |
| POST | `/clubs/[id]/tournaments` | Staff | `{ name, size: 4\|8\|16\|32, fee? }` (REGISTRATION phase) |
| PATCH | `/clubs/[id]/tournaments` | Staff | `{ tournamentId, action: "register"\|"start"\|"score", tournamentMatchId?, setsText? }` |
| GET | `/clubs/[id]/tournaments/[tournamentId]` | Member | Bracket rounds, matchups, seeded players, standings |

`setsText` format: `"21-15, 19-21, 23-21"`.

## Leaderboards & Statistics

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/leaderboards` | Member | `category=RATING\|WIN_RATE\|ATTENDANCE\|STREAK\|POINTS\|TOURNAMENT_WINS\|PENALTY_AVOIDANCE\|PARTNERSHIP&period=WEEK\|MONTH\|QUARTER\|YEAR\|ALL` |
| GET | `/players/[id]/statistics?clubId=` | Member | Personal analytics (form, win streaks, frequent partners, head-to-head records) |

## Dashboard & Audit

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/dashboard` | Staff | Real-time KPI pulse: members count, attendance %, wallet float, revenue, live matches |
| GET | `/clubs/[id]/audit` | Staff | Paginated audit trail with actor details, action types, and entity references |

## AI Coaching & Video Analysis (PREMIUM)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/coaching` | Gate AI_COACHING | AI performance insight for self (staff: `?userId=`) — cached 12 hours |
| POST | `/clubs/[id]/coaching` | Gate | Force instant regeneration of coaching insights |
| GET | `/clubs/[id]/videos` | Gate VIDEO_ANALYSIS | User's video uploads (staff see all): `{ id, fileName, status }` |
| POST | `/clubs/[id]/videos` | Gate | Multipart upload `file` (MP4/WebM ≤ 100MB) |
| GET | `/clubs/[id]/videos/[videoId]` | Gate | Video status & CV metrics `{ status, analysis }` (footwork, smash speed, coverage) |

## Play Groups (Open Community Squads)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/groups` | ✅ | Discovery feed & squad search `?q=&city=&myOnly=` |
| POST | `/groups` | ✅ | Create new PlayGroup `{ name, description?, city?, skillLevel?, isPublic? }` (creator becomes LEADER) |
| GET | `/groups/[id]` | ✅ | Group details with roster, upcoming meetups, and community discussions |
| PATCH | `/groups/[id]` | Leader | Update squad details `{ name?, description?, city?, skillLevel?, isPublic?, logoUrl? }` |
| DELETE | `/groups/[id]` | Leader | Soft-delete / disband PlayGroup |
| GET | `/groups/[id]/members` | Member | List squad players with roles and profiles |
| POST | `/groups/[id]/members` | ✅ | Join PlayGroup (instant for public squads, pending for private) |
| DELETE | `/groups/[id]/members` | Member | Leave squad |
| PATCH | `/groups/[id]/members/[userId]` | Leader | Change member role `{ role: "LEADER" \| "MEMBER" }` or remove player `{ remove: true }` |
| DELETE | `/groups/[id]/members/[userId]` | Leader | Remove player from squad |
| GET | `/groups/[id]/sessions` | Member | List scheduled meetup sessions |
| POST | `/groups/[id]/sessions` | Member | Schedule new meetup session `{ title, scheduledDate, clubName, maxPlayers?, costPerPlayer?, notes? }` |
| DELETE | `/groups/[id]/sessions/[sessionId]` | Leader | Cancel scheduled session |
| POST | `/groups/[id]/sessions/[sessionId]/rsvp` | Member | RSVP for session `{ status: "YES" \| "MAYBE" \| "NO" }` |
| GET | `/groups/[id]/posts` | Member | Community discussion feed |
| POST | `/groups/[id]/posts` | Member | Post message to squad wall `{ content }` |
| DELETE | `/groups/[id]/posts/[postId]` | Leader | Remove message from squad wall |
| GET | `/groups/[id]/analytics` | Leader | Squad statistics `{ members, sessions, posts, totalConfirmedRsvps }` |

## Club Admin Console

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/admin/overview` | Staff | Cockpit KPIs: member breakdown, active courts, matches, wallet pool, recent audits |
| GET | `/clubs/[id]/admin/revenue` | Staff | Financial breakdown `?days=30`: transaction categories, inflows vs outflows, unpaid penalties |
| POST | `/clubs/[id]/admin/announcements` | Staff | Broadcast push notification to all active club members `{ title, body }` |
| GET | `/clubs/[id]/admin/reports/attendance` | Staff | Exportable attendance dataset `?startDate=&endDate=&userId=` |
| GET | `/clubs/[id]/admin/reports/financial` | Staff | Exportable financial ledger dataset `?startDate=&endDate=` |

## Platform Super Admin Console

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/platform/overview` | SUPER_ADMIN | Multi-tenant platform KPIs, 7d/30d registration & match trends, club directory |
| GET | `/platform/users` | SUPER_ADMIN | Paginated platform user directory with search and role filter `?page=&search=&role=` |
| PATCH | `/platform/users/[userId]` | SUPER_ADMIN | Toggle Super Admin role `{ role: "SUPER_ADMIN" \| "PLAYER" }` or suspend `{ action: "suspend" }` |
| DELETE | `/platform/users/[userId]` | SUPER_ADMIN | Soft-delete user account |
| PATCH | `/platform/clubs/[clubId]/plan` | SUPER_ADMIN | Switch club subscription plan `{ plan: "FREE" \| "PRO" \| "PREMIUM" }` |
| DELETE | `/platform/clubs/[clubId]` | SUPER_ADMIN | Soft-delete tenant club |
| GET | `/platform/groups` | SUPER_ADMIN | Paginated directory of all community PlayGroups `?page=&search=` |
| DELETE | `/platform/groups/[groupId]` | SUPER_ADMIN | Soft-delete / disband PlayGroup platform-wide |
| GET | `/platform/audit` | SUPER_ADMIN | Cross-tenant platform-wide immutable audit trail `?page=&pageSize=` |

## Notifications, Uploads & Health

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/notifications` | ✅ | User notifications `{ items, unread }` |
| POST | `/notifications` | ✅ | Mark read `{ id? }` or `{ all: true }` |
| POST | `/uploads` | ✅ | Multipart image upload ≤ 5MB (PNG/JPEG/WebP) → `{ url, key }` |
| GET | `/files/*key` | – | Stream stored asset |
| GET | `/health` | – | Server health check: `{ database: "up", uptimeSec }` |
