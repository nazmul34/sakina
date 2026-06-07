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

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://10.0.2.2:8000` | Backend base URL. `10.0.2.2` is the host loopback from the Android emulator; use your LAN IP for a physical device. |

## EAS Build (cloud builds)

[EAS Build](https://docs.expo.dev/build/introduction/) runs Android/iOS builds on
Expo's cloud infrastructure without requiring the local Android toolchain.

### Prerequisites

```bash
npm install -g eas-cli
eas login          # authenticate with your Expo account
```

### Build profiles (`eas.json`)

| Profile | Distribution | Android artifact | Purpose |
|---|---|---|---|
| `development` | internal | APK (debug) | Dev-client APK for real device/emulator testing of native modules |
| `preview` | internal | APK | QA/stakeholder testing without a store listing |
| `production` | store | AAB | Play Store submission |

### Build commands

```bash
# Build a dev-client APK and share it internally
eas build --profile development --platform android

# Build a preview APK
eas build --profile preview --platform android

# Build a production AAB for the Play Store
eas build --profile production --platform android
```

After the `development` build finishes, download and install the APK on your
device, then start the local Metro bundler:

```bash
npm start   # expo start --dev-client — scan the QR code from the installed dev-client app
```

### Signing-key decision

**Current decision: EAS-managed credentials** (the default).

EAS generates and stores the Android keystore on Expo's servers, encrypted at
rest. This is the simplest option for a small team and costs nothing on the free
tier. The keystore can be exported at any time via `eas credentials` if you later
want to self-host or move to manual management.

Manual keystore management (checking the keystore into secret storage) remains an
option; revisit this decision before the first production release.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Metro bundler for the dev client |
| `npm run android` | Build + run on Android (dev client, local build) |
| `npm run ios` | Build + run on iOS (lite, no auto-silent) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run typecheck` | `tsc --noEmit` |
