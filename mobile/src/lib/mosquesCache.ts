/**
 * On-device cache of the last successful nearby-mosque result (FR-2.3).
 *
 * When a `GET /mosques` call times out or fails, the UI still has something to
 * show: the most recent results we did manage to fetch, plus when we fetched
 * them so the user can be told they're stale. This is a single JSON blob (one
 * list + a timestamp), so AsyncStorage is the right fit — SQLite would be
 * overkill for data we never query, and SecureStore is for small secrets, not a
 * multi-KB list.
 *
 * Distinct from the server-side tile cache (#47): that minimises Geoapify calls
 * across users; this is a per-device offline/last-known fallback for one list.
 *
 * Reads and writes are best-effort — a corrupt or unavailable cache must never
 * break the live list — so both swallow errors and degrade to "no cache".
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { NearbyMosque } from './mosques';

const CACHE_KEY = 'sakina.mosques_cache';

export interface CachedMosques {
  readonly mosques: NearbyMosque[];
  /** Epoch ms when these results were fetched from the network. */
  readonly fetchedAt: number;
}

/** Read the cached results, or `null` if absent/corrupt/unavailable. */
export async function readMosquesCache(): Promise<CachedMosques | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CachedMosques;
    if (!Array.isArray(parsed.mosques) || typeof parsed.fetchedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Persist a fresh result set with the time it was fetched. Best-effort. */
export async function writeMosquesCache(
  mosques: NearbyMosque[],
  fetchedAt: number,
): Promise<void> {
  try {
    const payload: CachedMosques = { mosques, fetchedAt };
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // A failed cache write must not turn a successful fetch into a failure.
  }
}
