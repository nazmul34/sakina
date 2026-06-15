/**
 * Nearby-mosque discovery client (EPIC-02, FR-2.1).
 *
 * Wraps `GET /mosques`, the backend seam that ranks mosques by haversine
 * distance (Geoapify primary, Overpass fallback, #47 tile cache behind it). The
 * search radius is **fixed server-side** (`MOSQUE_SEARCH_RADIUS_M`), so the
 * client deliberately sends only `lat`/`lng` — there is no radius to pass and no
 * radius control in the app.
 *
 * Scope here is just the fetch + shape mapping. The results UI (#45), the
 * 15 s timeout + cached fallback (#44), and movement-based re-fetch (#43) build
 * on top of this.
 */

import { apiFetch } from './api';
import type { LatLng } from './geofencing/types';
import { getHighAccuracyFix } from './location';

/**
 * Hard timeout (ms) for a `GET /mosques` request (FR-2.3). Matches the server's
 * own Geoapify budget (`GEOAPIFY_TIMEOUT_S`, 15 s): past this the user is better
 * served by cached results than a spinner that never resolves.
 */
export const MOSQUES_REQUEST_TIMEOUT_MS = 15_000;

/** A nearby mosque as the app consumes it (camelCase; provider fields hidden). */
export interface NearbyMosque {
  /** Opaque, stable id from the backend — safe to use as a list key. */
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  /** Great-circle distance from the query point, in metres. */
  readonly distanceM: number;
}

/** Raw `GET /mosques` payload shape (snake_case, as the backend serialises it). */
interface MosquesResponse {
  readonly count: number;
  readonly radius_m: number;
  readonly mosques: readonly {
    readonly id: string;
    readonly name: string;
    readonly lat: number;
    readonly lng: number;
    readonly distance_m: number;
  }[];
}

/**
 * Fetch mosques near `at`, nearest first. No radius is sent — the server fixes
 * it. Aborts after `timeoutMs` (default {@link MOSQUES_REQUEST_TIMEOUT_MS}) so a
 * dead network can't hang the list. Throws on timeout or a non-2xx response
 * (incl. `502` when every provider is down) so the caller can fall back to its
 * cache (#44).
 */
export async function fetchNearbyMosques(
  at: LatLng,
  { timeoutMs = MOSQUES_REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<NearbyMosque[]> {
  const query = new URLSearchParams({
    lat: String(at.latitude),
    lng: String(at.longitude),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await apiFetch(`mosques?${query.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Nearby mosques request failed (HTTP ${response.status})`);
    }

    const body = (await response.json()) as MosquesResponse;
    return body.mosques.map((m) => ({
      id: m.id,
      name: m.name,
      latitude: m.lat,
      longitude: m.lng,
      distanceM: m.distance_m,
    }));
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error(`Nearby mosques request timed out after ${timeoutMs} ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Acquire a high-accuracy fix, then fetch mosques around it (FR-2.1) — the
 * acquire-then-query order the feature requires. This is the entry point the
 * results screen calls; it propagates {@link LocationPermissionError} and fetch
 * errors to the caller.
 */
export async function getNearbyMosques(): Promise<NearbyMosque[]> {
  const fix = await getHighAccuracyFix();
  return fetchNearbyMosques(fix);
}
