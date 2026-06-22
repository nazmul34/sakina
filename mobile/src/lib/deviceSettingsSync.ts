/**
 * Offline-first reconciliation of device settings with the backend (FR-8.2).
 *
 * The local stores are always writable with no network; this module mirrors the
 * synced settings up and then adopts the server's reconciled truth. Conflict
 * resolution is **last-write-wins on `updatedAt`**, enforced server-side — so a
 * push is safe to repeat: a stale local edit can't clobber fresher server state,
 * and re-pushing unchanged settings is a no-op.
 *
 * Scope: this currently syncs only the AsyncStorage-backed settings — the prayer
 * calculation method and Asr method ({@link ./prayerSettings}). The native
 * auto-silent toggle has its own boot-time-readable native store and is mirrored
 * separately in a later slice; the partial `PUT` here leaves the server's other
 * fields (theme, radius, auto_silent) untouched.
 *
 * The flow each sync:
 *   1. PUT the local prayer settings tagged with the local sync clock;
 *   2. the server applies last-write-wins and returns the merged state;
 *   3. if the server's state is strictly newer than our clock, adopt it locally
 *      (and advance the clock to the server's), otherwise keep what we have.
 *
 * **Trigger:** on app foreground / launch only (wired in `App.tsx`), mirroring
 * the pins sync. A change made offline is pushed on the next foreground; we don't
 * sync on every keystroke. It's best-effort — any network failure aborts and
 * leaves local state (and its pending change) intact for the next attempt. A
 * single in-flight guard coalesces overlapping triggers.
 */

import {
  putServerSettings,
  type ServerDeviceSettings,
} from './deviceSettingsApi';
import { getLocalUpdatedAt } from './deviceSettings';
import {
  adoptPrayerTimesConfig,
  getPrayerTimesConfig,
} from './prayerSettings';
import type { PrayerTimesConfig } from './prayerTimes';

let inFlight: Promise<PrayerTimesConfig> | null = null;

/**
 * Reconcile local settings with the server and return the resulting prayer
 * config. Coalesces concurrent calls into one round-trip. Rejects (leaving local
 * state intact) if the network is unavailable.
 */
export function syncDeviceSettings(): Promise<PrayerTimesConfig> {
  if (!inFlight) {
    inFlight = reconcile().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function reconcile(): Promise<PrayerTimesConfig> {
  const [local, localUpdatedAt] = await Promise.all([
    getPrayerTimesConfig(),
    getLocalUpdatedAt(),
  ]);

  // Push our state tagged with the local clock; the server reconciles by LWW and
  // returns the winning row (which may be newer, e.g. an edit from another device).
  const server = await putServerSettings({
    prayerMethod: local.method,
    asrMethod: local.asr,
    updatedAt: localUpdatedAt,
  });

  return adopt(server, localUpdatedAt, local);
}

async function adopt(
  server: ServerDeviceSettings,
  localUpdatedAt: number,
  local: PrayerTimesConfig,
): Promise<PrayerTimesConfig> {
  const serverUpdatedAt = Date.parse(server.updated_at);
  // Strictly-newer server state wins; equal/older means our push already carried
  // the truth, so there's nothing to adopt.
  if (!Number.isFinite(serverUpdatedAt) || serverUpdatedAt <= localUpdatedAt) {
    return local;
  }
  const pulled: PrayerTimesConfig = {
    method: server.prayer_method as PrayerTimesConfig['method'],
    asr: server.asr_method as PrayerTimesConfig['asr'],
  };
  await adoptPrayerTimesConfig(pulled, serverUpdatedAt);
  return pulled;
}

/**
 * Fire-and-forget sync that never rejects — for app-foreground / launch triggers
 * where a failed sync should be invisible. Returns the synced prayer config on
 * success, or `null` if it couldn't reach the server (the caller keeps showing
 * local state).
 */
export async function trySyncDeviceSettings(): Promise<PrayerTimesConfig | null> {
  try {
    return await syncDeviceSettings();
  } catch {
    return null;
  }
}
