# REST API Reference

Base URL: `/api` · Content type: `application/json` (except uploads)

Every response uses a consistent envelope:

```jsonc
// success
{ "ok": true, "data": { /* … */ } }

// error
{ "ok": false, "error": { "code": "FORBIDDEN", "message": "Not a member of this club" } }
```

**Error codes:** `VALIDATION` · `UNAUTHORIZED` (401) · `FORBIDDEN` (403) · `NOT_FOUND` (404) ·
`CONFLICT` (409) · `FEATURE_LOCKED` (402, plan gate) · `RATE_LIMITED` (429) · `INTERNAL` (500).

Auth is an HttpOnly JWT session cookie (`bcos_session`). Send credentials with every request
(`fetch(…, { credentials: "include" })` or same-origin by default in the app's `api()` helper).

---

## Auth

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| POST | `/auth/register` | – | `{ name, email, password, mobile?, dob?, gender? }` → creates user + session |
| POST | `/auth/login` | – | `{ email, password }` → session cookie |
| POST | `/auth/otp/request` | – | `{ mobile }` → mock OTP; response includes `devCode` |
| POST | `/auth/otp/verify` | – | `{ mobile, code }` → session cookie |
| POST | `/auth/google/callback` | – | Mock Google sign-in → session |
| POST | `/auth/forgot` | – | `{ email }` → reset path (mock: returned as `devResetPath`) |
| POST | `/auth/reset` | – | `{ token, newPassword }` |
| POST | `/auth/change-password` | ✅ | `{ currentPassword \| null, newPassword }`; revokes other sessions |

## Users

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/users/me` | ✅ | Profile + club memberships |
| PATCH | `/users/me` | ✅ | Update profile fields (`name`, `skillLevel`, `playingStyle`, …) |

## Clubs

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs` | – | Public directory: `?q=&city=` search, joinable clubs |
| POST | `/clubs` | ✅ | Create club (creator becomes OWNER) — `{ name, city?, description?, lat?, lng? }` |
| GET | `/clubs/[id]` | – | Public club profile + stats |
| PATCH | `/clubs/[id]` | Staff | Update details / `settings` (attendance & booking config) |
| POST | `/clubs/[id]/join` | ✅ | Request membership `{ message? }` |

## Members (staff)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/members` | Member | `?status=ACTIVE\|PENDING\|REMOVED` list w/ wallets & ratings |
| POST | `/clubs/[id]/members` | Staff | Add directly `{ userId? \| email+name, role? }` |
| PATCH | `/clubs/[id]/members/[memberId]`* | Staff | Change role / approve / reject / remove |

\* handled via body `memberId` on PATCH.

## Attendance

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/attendance` | Member | `view=day&day=YYYY-MM-DD` roster · `view=matrix&month=` grid · `view=history&userId=` personal summary |
| GET | `/clubs/[id]/attendance/qr` | Staff | Today's QR token `{ token, expiresInSec, day }` |
| POST | `/clubs/[id]/attendance/checkin` | Member | `{ token?, lat?, lng?, note?, dayKey? }` → PRESENT/LATE/GUEST |
| POST | `/clubs/[id]/attendance/run-daily` | Staff | Sweep: mark absentees, issue configured penalties |

## Wallet

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/wallet` | Member | Own wallet, month credit/debit/net, dues, recent txns |
| GET | `/clubs/[id]/wallet/transactions` | Member | Own list. Staff: `?userId=&type=&page=` · `?view=balances` all members |
| POST | `/clubs/[id]/wallet/transactions` | Staff | Manual adjustment `{ userId, amount±, description }` |
| POST | `/clubs/[id]/wallet/refund` | Staff | Reverse a transaction `{ transactionId, reason? }` |

All amounts are integer paise (₹1 = 100). Ledger is append-only; refunds create REFUND rows and mark
the original REVERSED.

## Penalties ("lassi")

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/penalties` | Member | Own ledger + summary. Staff: `?userId=` anyone, `?view=summary` totals |
| POST | `/clubs/[id]/penalties` | Staff | Manual issue `{ userId, eventType, label?, amount?, reason? }` |
| GET/POST/DELETE | `/clubs/[id]/penalties/rules` | Staff | CRUD-lite rules per eventType (`DELETE ?ruleId=`) |
| POST | `/clubs/[id]/penalties/reverse` | Staff | Reverse penalty `{ penaltyId, reason? }` |

Auto-issued events: `LATE`, `ABSENCE`, `LOSS`, `WALKOVER`.

## Courts & bookings (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/courts` | Member | Courts + live status (OCCUPIED while matches run) |
| POST/PATCH | `/clubs/[id]/courts` | Staff | Add court / edit fee, name, status |
| GET | `/clubs/[id]/bookings` | Member | `view=mine` · staff date board `?date=YYYY-MM-DD` |
| POST | `/clubs/[id]/bookings` | Member | `{ courtId, startTime, endTime, forUserId?(staff), notes? }` — conflicts rejected, wallet debited |
| DELETE | `/clubs/[id]/bookings?bookingId=` | Owner/staff | Cancel (fee refunded to wallet) |

## Matches & ratings

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/matches` | Member | `status=SCHEDULED,IN_PROGRESS,…&userId=&day=&page=` |
| POST | `/clubs/[id]/matches` | Staff | `{ type, teamAUserIds, teamBUserIds, courtId?, scheduledAt?, notes? }` |
| GET | `/clubs/[id]/matches/[matchId]` | Member | Detail incl. `ratingChanges` when completed |
| POST | `/clubs/[id]/matches/[matchId]` | Staff | `{ action: "start" }` · `{ action:"score", sets:[{a,b}] }` · `{ action:"complete", sets }` · `{ action:"walkover", winnerTeamIndex }` · `{ action:"cancel" }` |
| PATCH | `/clubs/[id]/matches/[matchId]` | Staff | Edit teams/court/schedule before completion |
| GET | `/clubs/[id]/players/[userId]/rating` | Member | PlayerRating row + recent history |

Scoring validates badminton rules (win at ≥21 with 2-point lead, cap 30 at 29-29, best-of-3).
Completion runs inside one transaction: score replace → LOSS/WALKOVER penalties → team-average Elo
update → rating history.

## Matchmaking (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/matchmaking/generate` | Gate MATCHMAKING | Preview pairings from checked-in players `{ mode=SINGLES\|DOUBLES, courts? }` |
| POST | `/clubs/[id]/matchmaking/generate` | Gate | `{ apply: true, mode }` — creates SCHEDULED matches from preview |

## Tournaments (PRO)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/tournaments` | Member | List with participant counts |
| POST | `/clubs/[id]/tournaments` | Staff | `{ name, size: 4\|8\|16\|32, fee? }` (REGISTRATION) |
| PATCH | `/clubs/[id]/tournaments` | Staff | `{ tournamentId, action: "register" }` · `"start"` · `{ action:"score", tournamentMatchId, setsText }` |
| GET | `/clubs/[id]/tournaments/[tournamentId]` | Member | Bracket rounds, names, standings |

`setsText` format: `"21-15, 19-21, 23-21"`.

## Leaderboards & statistics

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/leaderboards` | Member | `category=RATING\|WIN_RATE\|ATTENDANCE\|STREAK\|POINTS\|TOURNAMENT_WINS\|PENALTY_AVOIDANCE\|PARTNERSHIP&period=WEEK\|MONTH\|QUARTER\|YEAR\|ALL` |
| GET | `/players/[id]/statistics?clubId=` | Member | Personal analytics (form, streaks, partners, head-to-head) |

## Dashboard & audit

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/dashboard` | Staff | KPI pulse: members, attendance %, wallet float, revenue, live matches |
| GET | `/clubs/[id]/audit` | Staff | Paginated audit trail with actor names |

## AI coaching & video analysis (PREMIUM)

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/clubs/[id]/coaching` | Gate | Insight for self (staff: `?userId=`) — cached 12h |
| POST | `/clubs/[id]/coaching` | Gate | Force regeneration |
| GET | `/clubs/[id]/videos` | Gate | Own uploads (staff see all): `{ id, fileName, status }` |
| POST | `/clubs/[id]/videos` | Gate | multipart `file` (MP4/WebM ≤ 100MB) |
| GET | `/clubs/[id]/videos/[videoId]` | Gate | Poll: `{ status, analysis }` — metrics land ~2.5s after upload (mock CV) |

Analysis shape: `{ footworkScore, shotAccuracy, courtCoverage, smashSpeedKmh, rallyCount, insights[] }`.

## Notifications, uploads, platform

| Method | Endpoint | Auth | Description |
| ------ | -------- | ---- | ----------- |
| GET | `/notifications` | ✅ | `{ items, unread }` |
| POST | `/notifications` | ✅ | Mark read `{ id? }` or `{ all: true }` |
| POST | `/uploads` | ✅ | multipart image ≤ 5MB (PNG/JPEG/WebP) → `{ url, key }` |
| GET | `/files/*key` | – | Stream uploaded file |
| GET | `/platform/overview` | SUPER_ADMIN | Platform KPIs + club table |
| PATCH | `/platform/clubs/[clubId]/plan` | SUPER_ADMIN | `{ plan: FREE\|PRO\|PREMIUM }` |
| GET | `/health` | – | `{ database: "up", uptimeSec }` |
