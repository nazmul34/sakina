/**
 * Local sync clock for device settings (F-07.2).
 *
 * Offline-first settings need a single logical "last changed locally" timestamp
 * to drive last-write-wins reconciliation with the backend `DeviceSettings`
 * (FR-8.2). The per-feature stores (e.g. {@link ./prayerSettings}) hold the
 * actual values; this module holds only the epoch-ms clock that says when the
 * user last changed any synced setting, persisted in AsyncStorage so it survives
 * restarts.
 *
 * Semantics: a fresh install reads `0` (epoch), meaning "no local authority yet"
 * — so the first sync lets the server's state win and pulls it down. A user edit
 * stamps `Date.now()`; adopting newer server state stamps the server's clock.
 * Keeping the clock separate from the value stores means {@link ./deviceSettingsSync}
 * can compare one timestamp without each feature having to track its own.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const UPDATED_AT_KEY = 'sakina.device_settings.updated_at';

/** Read the local sync clock (epoch ms); `0` when never set. */
export async function getLocalUpdatedAt(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(UPDATED_AT_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fall through to the epoch default
  }
  return 0;
}

/** Persist the local sync clock. Best-effort: a write failure leaves it unchanged. */
export async function setLocalUpdatedAt(updatedAt: number): Promise<void> {
  try {
    await AsyncStorage.setItem(UPDATED_AT_KEY, String(updatedAt));
  } catch {
    // best-effort
  }
}
