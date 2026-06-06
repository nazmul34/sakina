# Sakina Mobile

Expo (React Native) mobile app for Sakina, Android-first. This is the basic
scaffold (issue #2): a runnable skeleton with TypeScript, navigation, linting,
and an env-based API base URL. No feature screens or native modules yet.

> **Expo Go won't work** for the full app — the flagship ringer/DND feature
> needs a custom native module (PRD §8). This scaffold already includes
> `expo-dev-client` so we build a custom dev client from day one.

## Layout

```
mobile/
├── App.tsx                     # Root: SafeAreaProvider + NavigationContainer
├── index.ts                    # Expo entry point
├── app.json                    # Expo config (Android-first, dev-client plugin)
├── src/
│   ├── config/env.ts           # API base URL from EXPO_PUBLIC_* env
│   ├── navigation/             # Root stack navigator + route types
│   └── screens/HomeScreen.tsx  # Placeholder home screen
├── .env.example                # Copy to .env
├── eslint.config.js            # ESLint (eslint-config-expo + prettier)
└── .prettierrc.json
```

## Prerequisites

- Node.js (LTS) and npm
- Android Studio + an emulator (or a physical device), and a JDK for native builds
- A running [backend](../backend/README.md) for API calls

## Quick start

```bash
cd mobile
npm install
cp .env.example .env        # adjust EXPO_PUBLIC_API_BASE_URL if needed
```

Because we use a custom dev client (not Expo Go), build and install it once on
your device/emulator, then start the dev server:

```bash
npm run android             # expo run:android — builds + installs the dev client
# subsequent runs just need the bundler:
npm start                   # expo start --dev-client
```

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://10.0.2.2:8000` | Backend base URL. `10.0.2.2` is the host loopback from the Android emulator; use your LAN IP for a physical device. |

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Metro bundler for the dev client |
| `npm run android` | Build + run on Android (dev client) |
| `npm run ios` | Build + run on iOS (lite, no auto-silent) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc --noEmit` |
