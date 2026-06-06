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
