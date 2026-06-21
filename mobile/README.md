# Sakina Mobile

Expo (React Native) mobile app for Sakina, Android-first. This is the basic
scaffold (issue #2): a runnable skeleton with TypeScript, navigation, linting,
and an env-based API base URL, plus the first native module
([`RingerControl`](#native-modules)).

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
│   ├── components/             # Shared UI (e.g. RingerControl dev panel)
│   └── screens/HomeScreen.tsx  # Placeholder home screen
├── modules/
│   └── ringer-control/         # Local native module (Kotlin) — see Native modules
├── plugins/
│   ├── withVersionCode.js      # Derive Android versionCode from git
│   └── withRingerControl.js    # Add ACCESS_NOTIFICATION_POLICY permission
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

## Native modules

### RingerControl (issue #6)

`modules/ringer-control/` is a **local [Expo module](https://docs.expo.dev/modules/overview/)**
(Kotlin) that exposes the ringer + Do Not Disturb primitives the auto-silent
flagship (EPIC-01) is built on. It is **autolinked** — Expo discovers any module
under `modules/` with an `expo-module.config.json`, so there's no manual
registration. It only runs in the custom dev client; **Expo Go cannot load it**.

```
modules/ringer-control/
├── expo-module.config.json     # Declares the Android module for autolinking
├── index.ts                    # Public JS API (default export)
├── src/
│   ├── RingerControl.types.ts  # Typed native interface
│   └── RingerControlModule.ts  # requireNativeModule('RingerControl')
└── android/
    ├── build.gradle
    └── src/main/java/expo/modules/ringercontrol/
        ├── RingerControlModule.kt      # ModuleDefinition (the 5 methods)
        └── RingerControlExceptions.kt  # Coded errors
```

**JS API** (`import RingerControl from '../../modules/ringer-control'`):

| Method | Returns | Notes |
|---|---|---|
| `isDndAccessGranted()` | `boolean` | Whether the app holds Do Not Disturb (notification-policy) access. |
| `openDndSettings()` | `void` | Opens the system DND-access screen so the user can grant it. |
| `getRingerMode()` | `'silent' \| 'vibrate' \| 'normal'` | Current ringer mode. |
| `setRingerMode(mode)` | `void` | Sets the ringer. Throws `ERR_DND_ACCESS_NOT_GRANTED` without DND access, `ERR_INVALID_RINGER_MODE` for an unknown mode. |
| `getDeviceId()` | `string` | `Settings.Secure.ANDROID_ID` (per-install id; coordinate with F-00.4). |

The `HomeScreen` renders a small dev panel (`src/components/RingerControlPanel.tsx`)
that calls all five methods — use it to verify the module on a real device.

**Permission & config plugin.** Changing the ringer into/out of silent needs
`ACCESS_NOTIFICATION_POLICY` in the AndroidManifest. Because `android/` is
git-ignored and regenerated by `expo prebuild`, the permission is added by
`plugins/withRingerControl.js` (a config plugin) rather than a manual edit, so
it survives every prebuild. After granting **Do Not Disturb access** to Sakina
in system settings (via `openDndSettings()`), `setRingerMode()` takes effect.

**Min SDK.** The DND APIs used are available from API 23, below the project's
min SDK (API 24+), so no version guards are needed.

> After adding/removing a native module or changing the config plugin, run
> `npx expo prebuild --platform android --clean` and rebuild the dev client
> (`npm run android`). A JS-only reload won't pick up native changes.

## Share image card (F-04.4)

The Daily message screen can share a message two ways: as plain text (F-04.3)
and as a rendered **image card** for WhatsApp/Instagram stories & status
(F-04.4).

**Rendering lib — `react-native-view-shot`.** The card
(`src/components/MessageShareCard.tsx`) is rendered off-screen (laid out but
`opacity: 0`, non-interactive) and captured to a PNG with `captureRef`. The card
has fixed logical dimensions (360×640, a 9:16 portrait ratio) so the export is
crisp and consistent across devices — it's captured at the device pixel ratio,
yielding roughly 1080×1920 on a 3× screen.

**Sharing the file — `expo-sharing`.** `Sharing.shareAsync(uri, …)` hands the
PNG to the OS share sheet via a content URI, which is what Android share targets
expect. (React Native's `Share.share({ url })` only shares local image files
reliably on iOS, so it's kept for the text path only.) `expo-sharing` adds a
config plugin — rebuild the dev client after install (see the prebuild note
above).

**Template / branding decision.** Sakina-green field (`#1A6B3C`); a small
uppercase "Daily reminder" kicker; the message centred in a large semibold
weight under a decorative quote mark; an italic source label; and a **"Sakina"
wordmark + "Find your calm" tagline** footer so a re-shared card always carries
attribution back to the app. Long messages are not auto-fitted in v1 — the seed
content is short enough to fit; revisit with `adjustsFontSizeToFit` if longer
content lands.

## Saved messages (F-04.5)

Users can favorite a daily message (the heart on the Daily message screen) and
review their saved messages on a dedicated screen, **offline**.

**Storage decision — local-only (AsyncStorage).** Favorites are persisted on the
device (`src/lib/favorites.ts`, key `sakina.favorites`), storing the *whole*
message object — text, source label, category — not just its id. That keeps the
saved list fully renderable offline with no follow-up fetch, consistent with the
app's other on-device caches (e.g. the nearby-mosque last-known cache).

A server-synced favorites list (e.g. `GET /messages/saved`) was **deferred to
EPIC-07**, where cross-device sync is designed holistically (the same place the
pin sync lives). Until then this is a per-device list. The store is a small
reactive wrapper (`useFavorites()` over `useSyncExternalStore`) so the heart
toggle and the saved-list screen stay in sync without re-reading storage on
every focus.

## Daily reminder (F-04.6)

An optional daily notification that delivers a message at a user-chosen time.
The Daily reminder screen (reached from Home) has an enable/disable switch and a
time picker (`@react-native-community/datetimepicker`).

**D-7 decision — local on-device scheduling.** Per the PRD's recommendation
(cheapest option), reminders are scheduled locally with `expo-notifications`
(`src/lib/dailyReminder.ts`): a repeating `SchedulableTriggerInputTypes.DAILY`
trigger at the chosen hour/minute, on an Android `daily-reminder` channel. No
backend, no push tokens — it works offline once scheduled, and settings persist
in AsyncStorage (`sakina.daily_reminder`). Enabling requests OS notification
permission; a denial is surfaced and leaves the toggle off.

A **server-push** path (fresh content pushed daily, richer targeting/analytics)
is deferred to the **EPIC-09 Notifications Hub**, which will own scheduling
app-wide. Until then, note the local-scheduling caveat: a repeating local
notification reuses the same body each day, so the embedded message is refreshed
when the reminder is (re)scheduled — when the reminder screen is opened or the
time is changed. Different-every-day content requires the server-push path.

`expo-notifications` + `datetimepicker` are native modules, so rebuild the dev
client after install (see the prebuild note under Native modules).

## Prayer reminders (F-05.4)

Optional local notifications at each prayer time, configured in the Prayer times
screen (`src/lib/prayerNotifications.ts`): a master toggle, a sound on/off
toggle, and a per-prayer switch for the five prayers. Off by default; enabling
requests OS notification permission and surfaces a denial.

**D-8 decision — local scheduling, rolling window.** Prayer times shift slightly
day to day, so a single repeating trigger (what the daily reminder uses) would
drift. Instead we schedule one-shot `SchedulableTriggerInputTypes.DATE`
notifications for every enabled prayer across a rolling **7-day window**, and
re-schedule whenever the screen is opened or any setting/config changes
(cancel-then-schedule, so it's idempotent). That's ≤ 35 pending notifications —
well under the OS limits — and works fully offline, computed on-device from the
saved method/Asr config. Settings persist in AsyncStorage
(`sakina.prayer_notifications`); a cross-device mirror is **EPIC-07**.

**D-9 decision — standard reminder, not Adhan audio (yet).** v1 fires a standard
reminder notification on a **HIGH-importance** Android channel with the default
notification tone, plus a per-user sound on/off toggle. Because Android pins
sound at the channel level, the toggle is implemented as two channels
(`prayer-reminders` / `prayer-reminders-silent`). Playing a full **Adhan audio**
clip — a bundled sound asset on a dedicated channel with foreground playback — is
deferred; it's a larger media concern beyond "schedule a reminder per prayer."

**Coexisting schedulers.** With two local schedulers now (daily reminder +
prayer reminders), the old "cancel *all* scheduled notifications and reschedule"
approach would wipe the other feature. `src/lib/notifications.ts` is the shared
plumbing: each scheduler tags its notifications with a `source` and cancels only
its own (`cancelScheduledBySource`). EPIC-09 (Notifications Hub) will own this
centrally. No native rebuild is needed — the new channels are created at runtime.

## Prayer-aware silent (F-05.5 → F-01.10)

The synergy between prayer times and the flagship: near a mosque, *tighten*
silencing to the prayer window (just before jamaat to the end of salah) instead
of the whole time you're inside the geofence.

**D-2 decision (EPIC-13) — Phase 2 lean, opt-in, default off.** Per the PRD, v1
stays focused on reliable geofence-based silencing, so prayer-aware silent ships
as an **opt-in** toggle that is **off by default**. The flagship's runtime path
is unchanged unless a user turns it on.

**Window source.** Jamaat times aren't known precisely without crowdsourced data
(**EPIC-08**), so a window is derived from the **computed adhan time + a jamaat
offset**: `[adhan + jamaatOffset − preMinutes, adhan + jamaatOffset + salahMinutes]`
(`src/lib/prayerWindows.ts`, defaults 10/5/20 min). When prayer times or location
are unknown the feature degrades gracefully to plain geofence presence.

**What ships here (the FR-5.5 bridge).** The prayer windows are *exposed to the
auto-silent logic* as a pure, total decision:
`evaluatePrayerAwareSilence(settings, location, config, now)` in
`src/lib/prayerAwareSilent.ts` returns the window that should be silenced right
now, or `null`. The opt-in setting (AsyncStorage `sakina.prayer_aware_silent`,
cross-device mirror = EPIC-07) and a live "Active now" indicator are in the
Prayer times screen.

**Remaining step (tracked under F-01.10 / #26).** *Acting* on that decision in
the background — scheduling the native ringer change at window boundaries while
inside a zone — is a native (Kotlin `AutoSilent` + AlarmManager) change kept out
of the bridge PR to protect flagship reliability; it must be verified on-device.
The native consumer will call the same `evaluatePrayerAwareSilence` contract, so
JS, native, and tests share one source of truth. See `src/lib/geofencing/NOTES.md`.

## Versioning (per release)

Two numbers ship with every Android build:

| | Source of truth | Who bumps it |
|---|---|---|
| `versionName` (human-facing, e.g. `1.0.1`) | `expo.version` in `app.json` | **You**, manually, per release (semantic) |
| `versionCode` (integer Android compares) | git commit count | **Automatic** — `plugins/withVersionCode.js` |

Android refuses to install an APK whose `versionCode` isn't higher than the
installed one, so it must increase every release. Rather than hand-bump it,
`plugins/withVersionCode.js` injects a Gradle helper that sets
`versionCode = git rev-list --count HEAD`. Every commit ⇒ a higher code,
automatically, for both local `./gradlew` builds and EAS.

**Per release, you only:**
1. Bump `expo.version` in `app.json` if the semantic version changed (e.g. `1.0.0` → `1.0.1`).
2. Commit (this advances the commit count → new `versionCode`).
3. Build.

> The plugin edits the generated `android/` project, so after changing the
> plugin run `npx expo prebuild --platform android --clean` once to re-apply it.
> `eas.json` uses `appVersionSource: "local"` so cloud builds read these same
> values.

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
