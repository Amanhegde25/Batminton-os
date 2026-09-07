# 🏸 Badminton Club OS

A complete operating system for running badminton clubs — member attendance, wallets, penalty rules ("lassi"), live court occupancy & bookings, match scoring with Elo ratings, AI matchmaking, knockout tournaments, leaderboards, AI coaching insights, and video rally analysis.

Includes both a **Web Platform (Next.js)** and a **Cross-Platform Mobile App (React Native & Expo)** connecting to a unified backend.

---

## 📁 Repository Structure

```text
.
├── Web/                  # Next.js 15 (App Router), Tailwind CSS, Prisma, SQLite/Postgres
│   ├── prisma/           # Database schema & seed scripts
│   ├── src/              # Web application, API routes, and components
│   └── docs/             # Architecture and API documentation
├── Mobile/               # React Native & Expo SDK 54 mobile application
│   ├── app/              # Expo Router file-based screens & navigation
│   └── src/              # Mobile contexts, API client, theme, and components
├── startall.bat          # One-click Windows script to start Web (port 3000) & Mobile (port 8081)
├── web.bat               # Starts Web Next.js server on port 3000
└── mobile.bat            # Starts Expo Metro bundler on port 8081
```

---

## ⚡ Quick Start

### Option A: One-Click Startup (Windows)

Double-click or run:
```cmd
.\startall.bat
```
This automatically spins up:
- **Client-Web & API Server**: http://localhost:3000
- **Client-Mobile (Expo Metro Bundler)**: http://localhost:8081

---

### Option B: Manual Setup

#### 1. Web Application & API Server

```bash
cd Web
npm install
npx prisma db push        # Create SQLite database (prisma/dev.db)
npm run db:seed           # Seed demo data (clubs, players, matches, tournament)
npm run dev               # Starts server on http://localhost:3000
```

#### 2. Mobile Application

```bash
cd Mobile
npm install

# Configure API URL in Mobile/.env (copy from .env.example)
# For physical devices, set EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000
npm run start
```

Press:
- `a` to launch in Android Emulator
- `i` to launch in iOS Simulator
- `w` to launch in Web browser preview
- Scan the displayed QR code with the **Expo Go** app on your physical iOS/Android phone.

---

## 🔑 Demo Accounts (After Seeding)

| Role                      | Email                 | Password       |
| ------------------------- | --------------------- | -------------- |
| Platform Admin            | `admin@bcos.app`      | `Admin@123!`   |
| Club Owner (PREMIUM club) | `player100@demo.club` | `Password123!` |
| Player                    | `player1@demo.club`   | `Password123!` |

> *Note: OTP login is mocked in development — the API response includes `devCode` for immediate verification without an SMS provider.*

---

## 🏆 Feature Matrix by Plan

| Feature                          | FREE | PRO | PREMIUM |
| -------------------------------- | :--: | :-: | :-----: |
| Members, roles, audit log        |  ✅  | ✅  |   ✅    |
| Attendance (QR / manual / sweeps)|  ✅  | ✅  |   ✅    |
| Wallet ledger & adjustments      |  ✅  | ✅  |   ✅    |
| Matches, Elo ratings, stats      |  ✅  | ✅  |   ✅    |
| Leaderboards                     |  ✅  | ✅  |   ✅    |
| Courts & bookings                |  ❌  | ✅  |   ✅    |
| Penalty rules ("lassi")          |  ❌  | ✅  |   ✅    |
| AI matchmaking                   |  ❌  | ✅  |   ✅    |
| Tournaments                      |  ❌  | ✅  |   ✅    |
| Rule-based AI coaching           |  ❌  | ❌  |   ✅    |
| Video analysis (mock CV)         |  ❌  | ❌  |   ✅    |

Plans are enforced server-side (`assertFeature`) on every gated route; the `/admin` dashboard lets platform admins switch any club's tier dynamically.

---

## 🛠️ Tech Stack & Architecture

- **Web Frontend & API**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons.
- **Database & ORM**: Prisma ORM with SQLite for local development (PostgreSQL-ready).
- **Mobile App**: Expo SDK 54, React Native 0.81, Expo Router, TanStack Query v5, `expo-secure-store`.
- **Authentication**: Email/password (scrypt), mobile OTP, JWT tokens with `tokenVersion` revocation.
- **Engines**: Doubles-aware Elo rating engine, bipartite fairness matchmaking optimizer, attendance sweep cron, and append-only financial wallet ledger.

---

## 📖 Documentation

- [`Web/docs/API.md`](Web/docs/API.md) — REST API endpoints with authentication & permission specifications.
- [`Web/docs/ARCHITECTURE.md`](Web/docs/ARCHITECTURE.md) — System architecture, database schema, rating math, and security model.
