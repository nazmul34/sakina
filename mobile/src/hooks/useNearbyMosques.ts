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
import { getHighAccuracyFix } from '../lib/location';
import { fetchNearbyMosques, type NearbyMosque } from '../lib/mosques';

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
  /** Force a fetch at the latest known position, ignoring the movement gate. */
  readonly refresh: () => void;
}

const toError = (err: unknown): Error =>
  err instanceof Error ? err : new Error(String(err));

export function useNearbyMosques(): UseNearbyMosques {
  const [mosques, setMosques] = useState<NearbyMosque[]>([]);
  const [status, setStatus] = useState<NearbyMosquesStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

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
      setMosques(next);
      setError(null);
      setStatus('success');
      lastFetchedAt.current = at;
    } catch (err) {
      if (mounted.current) {
        setError(toError(err));
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

    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        // Coarse OS pre-filter; the precise gate below is what enforces FR-2.4.
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
    )
      .then((sub) => {
        if (mounted.current) {
          subscription = sub;
        } else {
          // Unmounted before the subscription resolved — tear it down now.
          sub.remove();
        }
      })
      .catch((err) => {
        if (mounted.current) {
          setError(toError(err));
          setStatus('error');
        }
      });

    return () => {
      mounted.current = false;
      subscription?.remove();
    };
  }, [fetchAround]);

  return { mosques, status, error, refresh };
}
