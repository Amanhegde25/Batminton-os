# Badminton Club OS — Mobile App (Expo & React Native)

Cross-platform mobile application for iOS and Android powered by Expo Router, TanStack Query, and a shared data/client layer with the Next.js web application.

## Prerequisites

1. Node.js 18+ / 20+
2. Next.js server running in `../Web` (e.g., `npm run dev`)
3. Expo Go on your physical phone or an iOS Simulator / Android Emulator

## Getting Started

1. **Install dependencies**:
   ```bash
   cd Mobile
   npm install
   ```

2. **Configure API URL** (optional):
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   - **iOS Simulator**: Works out of the box with `http://localhost:3000`.
   - **Android Emulator**: Uses `http://10.0.2.2:3000` automatically.
   - **Physical Device**: Set `EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000`.

3. **Start the development server**:
   ```bash
   npm run start
   ```

4. **Launch on target**:
   - Press `a` for Android Emulator
   - Press `i` for iOS Simulator
   - Press `w` for Web preview
   - Scan QR code with Expo Go on physical iOS/Android phone

## Architecture Highlights

- **Expo Router**: File-based navigation structure in `app/` matching Next.js App Router conventions.
- **Unified Authentication**: Uses HMAC JWT tokens stored in `expo-secure-store`, sending `Authorization: Bearer <token>` to the Next.js API.
- **TanStack Query v5**: Handles caching, automatic refetching, and query invalidation.
- **Shared Packages**:
  - `@bcos/shared`: TypeScript types, validation schemas (Zod), and constants.
  - `@bcos/api-client`: Universal HTTP client used by both Web and Mobile.
