/**
 * Geofencing trigger for auto-silent (FR-1.2).
 *
 * OS-scheduled geofences (via `expo-location` + `expo-task-manager`) are what let
 * silencing fire even when the app is backgrounded or killed — far cheaper on
 * battery than polling (PRD §6.1). This module owns arming/disarming the geofence
 * set and re-selecting it as the user travels; the transitions themselves are
 * handled by the background task in `./task` and handed to the native ringer
 * state machine (F-01.3).
 *
 * The geofence registration persists across app-kill and is re-registered after a
 * reboot by expo-task-manager's own boot receiver, so this code does not need to
 * run at boot — only when the user toggles auto-silent or moves far enough to
 * warrant a fresh selection.
 */

import * as Location from 'expo-location';

import AutoSilent from '../../../modules/auto-silent';
import { GEOFENCING_TASK, REREGISTER_THRESHOLD_M } from './constants';
import { getGeofenceCandidates } from './candidates';
import { distanceMeters } from './geo';
import { selectRegions } from './selection';
import type { LatLng } from './types';

// Ensure the background task is defined (side-effect import) whenever any arming
// path is used, independent of the app-entry import.
import './task';

/** Position the current geofence set was selected around; null until armed. */
let anchor: LatLng | null = null;

/**
 * Request the location permissions geofencing needs, in the order Android
 * mandates: foreground first, then background (the OS rejects a background
 * request before foreground is granted). The full permissions UX is F-01.6; this
 * is the minimal gate the arming path needs. Returns whether background location
 * — the level geofencing actually requires — was granted.
 */
export async function ensureLocationPermissions(): Promise<boolean> {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return false;
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted;
}

/** Best-effort current position: last-known if available, else a fresh fix. */
async function currentPosition(): Promise<LatLng | null> {
  const last = await Location.getLastKnownPositionAsync();
  if (last) {
    return last.coords;
  }
  try {
    const fix = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return fix.coords;
  } catch {
    return null;
  }
}

/**
 * Register geofences for the user's current area. No-ops (and logs) rather than
 * throwing when the master toggle is off, permissions are missing, the position
 * is unknown, or there are no candidates yet — arming should never crash a caller.
 */
export async function armGeofencing(): Promise<void> {
  if (!AutoSilent.isEnabled()) {
    return;
  }
  if (!(await ensureLocationPermissions())) {
    console.warn('[geofencing] location permission not granted; not arming');
    return;
  }

  const center = await currentPosition();
  if (!center) {
    console.warn('[geofencing] no position fix; not arming');
    return;
  }

  const candidates = await getGeofenceCandidates(center);
  const regions = selectRegions(candidates, center);
  if (regions.length === 0) {
    // Nothing to monitor yet (e.g. no mosques/pins in range). Make sure any stale
    // set is torn down so we don't keep silencing on outdated zones.
    await disarmGeofencing();
    return;
  }

  await Location.startGeofencingAsync(GEOFENCING_TASK, regions);
  anchor = { latitude: center.latitude, longitude: center.longitude };
  console.info(`[geofencing] armed ${regions.length} region(s)`);
}

/** Tear down the geofence set, if any is registered. */
export async function disarmGeofencing(): Promise<void> {
  anchor = null;
  if (await Location.hasStartedGeofencingAsync(GEOFENCING_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCING_TASK);
    console.info('[geofencing] disarmed');
  }
}

/**
 * Re-select the geofence set around `center` once the user has moved past
 * {@link REREGISTER_THRESHOLD_M} from where it was last selected. Cheap to call
 * often (e.g. from F-02.4's movement updates) — it only re-registers when the
 * move is large enough to change the nearest-N selection.
 */
export async function refreshGeofencesForLocation(
  center: LatLng,
): Promise<void> {
  if (!AutoSilent.isEnabled()) {
    return;
  }
  if (anchor && distanceMeters(anchor, center) < REREGISTER_THRESHOLD_M) {
    return;
  }
  await armGeofencing();
}
