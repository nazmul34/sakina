/**
 * Nearby-mosque list with smart, movement-gated re-fetch (FR-2.4).
 *
 * Holds the current nearby-mosque list and keeps it fresh as the user moves,
 * without hammering the network while they sit still. A foreground
 * `watchPositionAsync` stream is the movement source; we re-query only once the
 * user is at least {@link MOVEMENT_REFETCH_THRESHOLD_M} from where we last
 * fetched. The OS `distanceInterval` is a coarse pre-filter; the precise gate is
 * enforced in JS, keyed off the last *fetched* position so a skipped/failed
 * fetch doesn't quietly move the goalposts. `refresh()` bypasses the gate for an
 * explicit pull-to-refresh.
 *
 * Foreground-only by design — the list is only on screen in the foreground;
 * background coverage for auto-silent is the OS geofence's job (F-01.2), not a
 * foreground watcher. The results UI (#45) consumes this hook, and the 15 s
 * timeout + cached fallback (#44) slots into the fetch path later.
 */

import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

import { distanceMeters } from '../lib/geofencing/geo';
import type { LatLng } from '../lib/geofencing/types';
import {
  ensureLocationPermission,
  getHighAccuracyFix,
  LocationPermissionError,
} from '../lib/location';
import { fetchNearbyMosques, type NearbyMosque } from '../lib/mosques';
import { readMosquesCache, writeMosquesCache } from '../lib/mosquesCache';

/**
 * Re-query once the user is at least this far (metres) from the last fetch
 * position (FR-2.4). Deliberately finer than the geofence re-registration
 * threshold (`REREGISTER_THRESHOLD_M`): refreshing a list is cheap, re-arming
 * the whole geofence set is not.
 */
export const MOVEMENT_REFETCH_THRESHOLD_M = 20;

export type NearbyMosquesStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UseNearbyMosques {
  readonly mosques: NearbyMosque[];
  readonly status: NearbyMosquesStatus;
  readonly error: Error | null;
  /**
   * Whether the currently shown `mosques` came from the on-device cache after a
   * failed/timed-out fetch, rather than a fresh response (FR-2.3). The UI uses
   * this with {@link lastUpdatedAt} to render a "showing cached results" notice.
   */
  readonly fromCache: boolean;
  /** Epoch ms the shown results were fetched from the network; null until any load. */
  readonly lastUpdatedAt: number | null;
  /**
   * Position the shown results were fetched around — the origin distances and
   * bearings are measured from (FR-2.4). Null until the first load.
   */
  readonly origin: LatLng | null;
  /** Force a fetch at the latest known position, ignoring the movement gate. */
  readonly refresh: () => void;
}

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err));

export function useNearbyMosques(): UseNearbyMosques {
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [status, setStatus] = useState<NearbyMosquesStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [origin, setOrigin] = useState<LatLng | null>(null);

  // Refs (not state) so the long-lived watch callback always reads the latest
  // values without the effect having to re-subscribe:
  //  - lastFetchedAt: the anchor the movement gate measures against.
  //  - latestPosition: most recent fix, so refresh() can fetch without waiting.
  //  - inFlight: collapse overlapping fetches into one.
  //  - mounted: drop async results that resolve after unmount.
  const lastFetchedAt = useRef<LatLng | null>(null);
  const latestPosition = useRef<LatLng | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  const fetchAround = useCallback(async (at: LatLng): Promise<void> => {
    if (inFlight.current) {
      return;
    }
    inFlight.current = true;
    setStatus('loading');
    try {
      const next = await fetchNearbyMosques(at);
      if (!mounted.current) {
        return;
      }
      const now = Date.now();
      setMosques(next);
      setError(null);
      setFromCache(false);
      setLastUpdatedAt(now);
      setOrigin(at);
      setStatus('success');
      lastFetchedAt.current = at;
      void writeMosquesCache(next, now, at);
    } catch (err) {
      // Timeout/network failure (FR-2.3): fall back to the last cached results
      // with a staleness marker, rather than blanking the list. Only a hard
      // error (no cache to show) surfaces as `status: 'error'`.
      const cached = await readMosquesCache();
      if (!mounted.current) {
        return;
      }
      setError(toError(err));
      if (cached) {
        setMosques(cached.mosques);
        setFromCache(true);
        setLastUpdatedAt(cached.fetchedAt);
        setOrigin(cached.origin);
        setStatus('success');
      } else {
        setStatus('error');
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  const refresh = useCallback((): void => {
    const at = latestPosition.current;
    if (at) {
      void fetchAround(at);
      return;
    }
    // No fix yet (the watch hasn't delivered one): acquire one, then fetch.
    void getHighAccuracyFix()
      .then((fix) => {
        latestPosition.current = fix;
        return fetchAround(fix);
      })
      .catch((err) => {
        if (mounted.current) {
          setError(toError(err));
          setStatus('error');
        }
      });
  }, [fetchAround]);

  useEffect(() => {
    mounted.current = true;
    let subscription: Location.LocationSubscription | null = null;

    void (async () => {
      // Ask for location when the list is opened without it, so the user gets a
      // prompt (and is asked again next visit) rather than a silent empty screen.
      const granted = await ensureLocationPermission();
      if (!mounted.current) {
        return;
      }
      if (!granted) {
        setError(new LocationPermissionError());
        setStatus('error');
        return;
      }
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            // Coarse OS pre-filter; the precise gate below enforces FR-2.4.
            distanceInterval: MOVEMENT_REFETCH_THRESHOLD_M,
          },
          ({ coords }) => {
            const here: LatLng = {
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
            latestPosition.current = here;

            const anchor = lastFetchedAt.current;
            if (
              !anchor ||
              distanceMeters(anchor, here) >= MOVEMENT_REFETCH_THRESHOLD_M
            ) {
              void fetchAround(here);
            }
          },
        );
        if (mounted.current) {
          subscription = sub;
        } else {
          // Unmounted before the subscription resolved — tear it down now.
          sub.remove();
        }
      } catch (err) {
        if (mounted.current) {
          setError(toError(err));
          setStatus('error');
        }
      }
    })();

    return () => {
      mounted.current = false;
      subscription?.remove();
    };
  }, [fetchAround]);

  // Seed from cache on mount so the list shows last-known results immediately
  // (FR-2.3) instead of an empty screen while the first fix + fetch resolve.
  // Bails if a fresh fetch already landed, so it never clobbers live data.
  useEffect(() => {
    let active = true;
    void readMosquesCache().then((cached) => {
      if (active && cached && lastFetchedAt.current === null) {
        setMosques(cached.mosques);
        setFromCache(true);
        setLastUpdatedAt(cached.fetchedAt);
        setOrigin(cached.origin);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return {
    mosques,
    status,
    error,
    fromCache,
    lastUpdatedAt,
    origin,
    refresh,
  };
}
