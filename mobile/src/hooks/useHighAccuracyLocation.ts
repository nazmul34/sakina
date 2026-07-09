/**
 * One-shot high-accuracy location, with recovery after the user grants access.
 *
 * Several screens (the prayer-time preview + countdown, the Qibla compass) need a
 * single GPS fix and used to take it once on mount via {@link getHighAccuracyFix}.
 * If that first attempt failed — almost always because location permission or the
 * device's Location service was off — they stayed stuck on the error/empty state
 * *even after the user turned location on*, until the app was killed and
 * relaunched. That's the "prayer times don't show until I close and reopen the
 * app" bug.
 *
 * This hook fixes that by re-attempting the fix whenever the app returns to the
 * foreground while we still don't have one: enabling location (in system settings
 * or the OS prompt) backgrounds then re-activates the app, so `active` is exactly
 * the moment to retry. A successful fix is sticky, so retries stop once we have
 * it. {@link HighAccuracyLocation.retry} also allows an explicit "try again".
 */

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { LatLng } from '../lib/geofencing/types';
import {
  ensureLocationPermission,
  getHighAccuracyFix,
  LocationPermissionError,
} from '../lib/location';

/** Where the fix currently stands: still trying, acquired, denied, or failed. */
export type LocationStatus = 'loading' | 'ready' | 'denied' | 'error';

export interface HighAccuracyLocation {
  /** The fix once acquired, else `null`. Sticky — a later failure never clears it. */
  readonly location: LatLng | null;
  readonly status: LocationStatus;
  /** Re-attempt the fix now (e.g. from a "try again" control). */
  readonly retry: () => void;
}

export function useHighAccuracyLocation(): HighAccuracyLocation {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('loading');
  // Bumping this re-runs the fetch effect (mount, manual retry, or foreground).
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    // Ask for location when the feature is opened without it (not just read it),
    // so the user gets a prompt rather than a blank screen — and is asked again
    // next time until they permanently deny.
    void (async () => {
      const granted = await ensureLocationPermission();
      if (!active) {
        return;
      }
      if (!granted) {
        setStatus('denied');
        return;
      }
      try {
        const fix = await getHighAccuracyFix();
        if (active) {
          setLocation(fix);
          setStatus('ready');
        }
      } catch (err: unknown) {
        if (active) {
          setStatus(
            err instanceof LocationPermissionError ? 'denied' : 'error',
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  // Recover after location is granted outside the app: that path backgrounds then
  // re-activates us, so retry on `active` while we still have no fix. Once a fix
  // lands `location` is non-null and this effect unsubscribes, so we stop.
  useEffect(() => {
    if (location !== null) {
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setAttempt((n) => n + 1);
      }
    });
    return () => sub.remove();
  }, [location]);

  return { location, status, retry };
}
