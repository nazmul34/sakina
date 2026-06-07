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
├── eas.json                    # EAS Build profiles (development / preview / production)
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
- The Android toolchain (see [Android toolchain setup](#android-toolchain-setup)) and an emulator or physical device
- A running [backend](../backend/README.md) for API calls

## Android toolchain setup

A first native Android build needs the full toolchain below. This stack (Expo
SDK 56 / RN 0.85 / Gradle 9.3.1) has two non-obvious gotchas — read them before
filing build errors.

### Install

1. **Android Studio** (`brew install --cask android-studio`). Run the Standard
   setup wizard — it installs the SDK to `~/Library/Android/sdk` and lets you
   create an emulator (AVD) via Device Manager. Its bundled JBR (JDK 21) runs
   the Gradle daemon.
2. **Command-line tools** for `sdkmanager`
   (`brew install --cask android-commandlinetools`).
3. **NDK + CMake** — required because `newArchEnabled=true` compiles C++. The
   Studio wizard does **not** install these:
   ```bash
   export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"  # sdkmanager needs a JDK
   sdkmanager --sdk_root="$HOME/Library/Android/sdk" "ndk;27.1.12297006" "cmake;3.22.1"
   ```
4. **JDK 17** — see gotcha 1. Install any JDK 17 (e.g. Temurin 17). The macOS
   `.pkg` cask needs `sudo`; a no-sudo alternative is to extract the Adoptium
   tarball into `~/.jdks/`.

### Environment (`~/.zshrc`)

```bash
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

### Gotcha 1 — JDK 17 toolchain & the foojay `IBM_SEMERU` crash

RN 0.85's Gradle plugin pins `kotlin { jvmToolchain(17) }`, so Gradle needs a
**JDK 17** toolchain — and Gradle matches the exact major version, so the JBR
(21) does **not** satisfy it. If no JDK 17 is found, Gradle tries to
auto-download one via `foojay-resolver-convention 0.5.0`, which references
`JvmVendorSpec.IBM_SEMERU` (removed in Gradle 9.x) and crashes with
`NoSuchFieldError`. Fix: install JDK 17 and register it so the downloader never
runs. Create `~/.gradle/gradle.properties`:

```properties
org.gradle.java.installations.paths=/absolute/path/to/jdk-17/Contents/Home
org.gradle.java.installations.auto-download=false
```

### Gotcha 2 — missing/corrupt NDK

The build needs NDK `27.1.12297006`. A failed download leaves a partial dir
(only `.installer/`, no `source.properties`) and fails with `[CXX1101] ... did
not have a source.properties file`. Remove the broken dir and reinstall via the
`sdkmanager` command above.

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

## EAS Build (cloud builds)

`npm run android` builds locally and is the fastest inner loop, but it needs the
full Android toolchain above. **EAS Build** compiles in the cloud instead — the
only supported way to produce shareable artifacts (an installable dev client for
testers, or a Play Store bundle). Profiles live in `eas.json`:

| Profile | Output | Distribution | Use |
|---|---|---|---|
| `development` | APK with `developmentClient: true` | internal | Install on a device, then connect the Metro bundler. Needed to load the native `RingerControl` module (issue #6) — Expo Go can't. |
| `preview` | release APK | internal | Hand a single installable file to testers; no dev tooling. |
| `production` | AAB (`app-bundle`), `autoIncrement` | store | Google Play submission. |

### One-time setup

```bash
npm install --global eas-cli
eas login                       # Expo account
eas init                        # links the project; writes extra.eas.projectId into app.json
```

> `eas init` requires an Expo account and is the step that populates
> `extra.eas.projectId` in `app.json` (intentionally not committed yet — it is
> account-specific and gets created on first `eas init`).

### Build commands

```bash
npm run build:dev               # eas build --profile development --platform android
npm run build:preview           # internal release APK
npm run build:prod              # production AAB for Play
```

Install a finished `development` build on your device, then run `npm start` to
attach the bundler.

### Signing keys — decision

**Use EAS-managed credentials** (the default). On the first Android build EAS
generates and stores the upload keystore for us; no keystore is checked into the
repo. To migrate to a self-managed keystore later, run
`eas credentials -p android` and supply your own — no code change required. This
keeps secrets out of git and matches the "free/cheap to run, solo dev" posture
of the PRD.

> **EAS free-tier budget:** the free plan caps the number of cloud builds per
> month. Prefer local `npm run android` for day-to-day iteration and reserve EAS
> builds for shareable dev-client / preview / production artifacts. If we hit the
> cap, self-host a build runner (`eas build --local`) on the dev machine.

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
| `npm run build:dev` | EAS cloud build — development dev-client APK (internal) |
| `npm run build:preview` | EAS cloud build — release APK for testers (internal) |
| `npm run build:prod` | EAS cloud build — production AAB for Google Play |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc --noEmit` |
