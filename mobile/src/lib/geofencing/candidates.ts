/**
 * Provider seam for geofence candidates (FR-1.2).
 *
 * Two sources feed the geofence set, returned here as one list and ranked +
 * capped together by {@link selectRegions} (pins first, then nearest mosques):
 *
 *   - **User pinned zones** (EPIC-03, FR-3.3) — read live from the on-device pin
 *     store, so a pin participates in auto-silent exactly like a mosque zone and,
 *     being local, always works offline. Wired below.
 *   - **Nearby mosques** (EPIC-02) — still a **dev-only** fixture placed a few
 *     hundred metres around the user so the combined enter → silence → exit →
 *     restore flow can be exercised on a device now. Production builds return no
 *     mosques until the Overpass/Geoapify-backed fetch + on-disk cache lands (see
 *     NOTES.md "Implementation reminders when EPIC-02 lands").
 */

import { readPins } from '../pins';
import type { GeofenceCandidate, LatLng } from './types';

/** ~metres-to-degrees at city latitudes; good enough to spread out a fixture. */
const DEG_PER_METER = 1 / 111_320;

const offset = (center: LatLng, northM: number, eastM: number): LatLng => ({
  latitude: center.latitude + northM * DEG_PER_METER,
  longitude:
    center.longitude +
    (eastM * DEG_PER_METER) / Math.cos((center.latitude * Math.PI) / 180),
});

/**
 * Map the user's live pinned zones to geofence candidates (FR-3.3). The pin's
 * `id` carries through as the geofence region id — what enter/exit events report
 * and what the ringer state machine reference-counts — and each pin keeps its own
 * radius so it silences over the ring the user chose.
 */
async function getPinCandidates(): Promise<GeofenceCandidate[]> {
  const pins = await readPins();
  return pins.map((pin) => ({
    id: pin.id,
    kind: 'pin',
    latitude: pin.latitude,
    longitude: pin.longitude,
    radius: pin.radiusM,
  }));
}

/** Dev-only nearby-mosque stand-in until the EPIC-02 fetch + cache lands. */
function devMosqueFixture(center: LatLng): GeofenceCandidate[] {
  return [
    { id: 'dev-mosque-n', kind: 'mosque', ...offset(center, 300, 0) },
    { id: 'dev-mosque-e', kind: 'mosque', ...offset(center, 0, 300) },
  ];
}

/**
 * Resolve nearby-mosque candidates around `center`. EPIC-02 seam: returns a
 * dev fixture in development and nothing in production, so no fake mosque
 * geofences are ever registered for real users.
 */
async function getMosqueCandidates(
  center: LatLng,
): Promise<GeofenceCandidate[]> {
  // TODO(EPIC-02): fetch nearby mosques around `center` (Overpass/Geoapify proxy
  // + on-disk cache), keeping the prior set on a failed fetch — see NOTES.md Q3.
  if (__DEV__) {
    return devMosqueFixture(center);
  }
  return [];
}

/**
 * Resolve the geofence candidates to consider around `center`: the user's pinned
 * zones plus nearby mosques. Async because the pin read hits disk and the real
 * mosque source will hit the network/cache.
 */
export async function getGeofenceCandidates(
  center: LatLng,
): Promise<GeofenceCandidate[]> {
  const [pins, mosques] = await Promise.all([
    getPinCandidates(),
    getMosqueCandidates(center),
  ]);
  return [...pins, ...mosques];
}
