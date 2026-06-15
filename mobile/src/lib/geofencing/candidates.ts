/**
 * Provider seam for geofence candidates (FR-1.2).
 *
 * The real sources land in later epics:
 *   - nearby mosques from the Overpass-backed discovery service (EPIC-02), and
 *   - user pinned zones (EPIC-03).
 *
 * Until those exist, this returns a small **dev-only** fixture placed a few
 * hundred metres around the user so the end-to-end flow (arm → enter → silence →
 * exit → restore) can be exercised on a device/emulator now. In production
 * builds it returns nothing, so no fake geofences are ever registered for real
 * users. When EPIC-02/03 land, replace the fixture body with the real fetch —
 * the signature is the contract the rest of the layer depends on.
 */

import type { GeofenceCandidate, LatLng } from './types';

/** ~metres-to-degrees at city latitudes; good enough to spread out a fixture. */
const DEG_PER_METER = 1 / 111_320;

const offset = (center: LatLng, northM: number, eastM: number): LatLng => ({
  latitude: center.latitude + northM * DEG_PER_METER,
  longitude:
    center.longitude +
    (eastM * DEG_PER_METER) / Math.cos((center.latitude * Math.PI) / 180),
});

function devFixture(center: LatLng): GeofenceCandidate[] {
  return [
    { id: 'dev-mosque-n', kind: 'mosque', ...offset(center, 300, 0) },
    { id: 'dev-mosque-e', kind: 'mosque', ...offset(center, 0, 300) },
    { id: 'dev-pin-sw', kind: 'pin', ...offset(center, -300, -300) },
  ];
}

/**
 * Resolve the geofence candidates to consider around `center`. Async because the
 * real implementation will hit the network/cache.
 */
export async function getGeofenceCandidates(
  center: LatLng,
): Promise<GeofenceCandidate[]> {
  // TODO(EPIC-02/03): fetch nearby mosques + pinned zones around `center`.
  if (__DEV__) {
    return devFixture(center);
  }
  return [];
}
