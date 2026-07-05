/**
 * High-accuracy location acquisition for nearby-mosque discovery (FR-2.1).
 *
 * Geofencing (F-01.2) registers OS regions and never needs a one-shot fix, but
 * the nearby-mosque query does: we must hand the backend a precise `(lat,lng)`
 * so the haversine ranking — and the coarse-but-fixed 5 km server radius — are
 * centred on where the user actually is. A coarse fix could be off by hundreds
 * of metres and skew "nearest mosque", so we ask for a high-accuracy fix.
 *
 * Permission is owned by the checklist flow ({@link ../screens/PermissionsScreen}
 * via {@link ./permissions}); this module only *reads* the foreground grant and
 * fails loudly if it's missing, so the caller can route the user to fix it
 * rather than silently returning a bad or empty result.
 */

import * as Location from 'expo-location';

import type { LatLng } from './geofencing/types';
import { runExclusive } from './permissionQueue';

/**
 * Thrown when a location fix is requested without the foreground permission the
 * OS requires. Distinct type so callers can branch to the permissions flow
 * instead of treating it as a transient/network error.
 */
export class LocationPermissionError extends Error {
  constructor(message = 'Location permission not granted') {
    super(message);
    this.name = 'LocationPermissionError';
  }
}

/**
 * Acquire a single high-accuracy GPS fix for the nearby query (FR-2.1).
 *
 * Requires the foreground location permission to already be granted (the
 * checklist drives the request); throws {@link LocationPermissionError} when it
 * isn't. `Accuracy.High` targets ~10 m, the right trade-off here — tight enough
 * for proximity ranking without the battery cost of `BestForNavigation`.
 */
export async function getHighAccuracyFix(): Promise<LatLng> {
  const { granted } = await Location.getForegroundPermissionsAsync();
  if (!granted) {
    throw new LocationPermissionError();
  }

  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { latitude: coords.latitude, longitude: coords.longitude };
}

// Dedupe concurrent foreground requests — the first-launch prompt and a screen
// mounting at the same time would otherwise fire two dialogs — into one ask.
let foregroundRequest: Promise<boolean> | null = null;

/**
 * Ensure the foreground location permission, *requesting* it if it's still
 * askable, and return whether it ends up granted.
 *
 * This is what makes the location-backed features (prayer times, Qibla, nearby
 * mosques) ask for access when you open them instead of silently showing
 * nothing — and ask again next time, until the user has permanently denied it (at
 * which point the OS stops showing the dialog and the caller falls back to a hint
 * / settings deep-link). Concurrent calls share a single request.
 */
export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!current.canAskAgain) {
    return false;
  }
  if (!foregroundRequest) {
    foregroundRequest = runExclusive(() =>
      Location.requestForegroundPermissionsAsync(),
    )
      .then((res) => res.granted)
      .finally(() => {
        foregroundRequest = null;
      });
  }
  return foregroundRequest;
}
