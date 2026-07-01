/**
 * Centralised runtime configuration for the app.
 *
 * Values come from `EXPO_PUBLIC_*` environment variables (see `.env.example`),
 * which Expo inlines at build time and exposes on `process.env`. Keeping all
 * env access in one module means the rest of the app imports typed constants
 * instead of reaching into `process.env` directly.
 */

/**
 * Base URL of the Sakina backend API.
 *
 * Default targets the Django dev server as seen from an Android emulator:
 * `10.0.2.2` is the host machine's loopback from inside the emulator. Override
 * via `EXPO_PUBLIC_API_BASE_URL` for a physical device, staging, or production.
 */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000';

/**
 * Whether to surface the developer/QA tools (the RingerControl panel and the
 * API/device footer in Settings).
 *
 * `__DEV__` alone can't gate these for distributable builds: a bundled APK —
 * whether a QA build or a real release — is always a production bundle with
 * `__DEV__ === false`, so it can't tell the two apart. We therefore add an
 * explicit opt-in: set `EXPO_PUBLIC_SHOW_DEV_TOOLS=1` when building a **testing**
 * APK (it's inlined into the bundle), and leave it unset for **release /
 * production**, which then always hide the dev tools.
 *
 * - Local debug build (Metro): `__DEV__` is true → shown, no env var needed.
 * - Testing APK: build with `EXPO_PUBLIC_SHOW_DEV_TOOLS=1` → shown.
 * - Release/production: flag unset → hidden.
 */
export const SHOW_DEV_TOOLS =
  __DEV__ || process.env.EXPO_PUBLIC_SHOW_DEV_TOOLS === '1';
