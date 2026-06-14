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
 * it. Throws on a non-2xx response (incl. `502` when every provider is down) so
 * the caller can decide how to surface failure / fall back to cache (#44).
 */
export async function fetchNearbyMosques(at: LatLng): Promise<NearbyMosque[]> {
  const query = new URLSearchParams({
    lat: String(at.latitude),
    lng: String(at.longitude),
  });

  const response = await apiFetch(`mosques?${query.toString()}`);
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
