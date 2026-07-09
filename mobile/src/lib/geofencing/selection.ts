/**
 * Pure geofence-selection strategy (FR-1.2) — no Expo or device imports, so it
 * can be reasoned about and unit-tested in isolation.
 *
 * Strategy, given Android's ~100-geofence cap:
 *   1. Pinned zones are user-chosen, so they come first (nearest pins win if pins
 *      alone exceed the cap).
 *   2. Remaining slots are filled with the nearest mosques within a bounded
 *      radius — far-away mosques are irrelevant until the user travels there, at
 *      which point re-registration re-selects around the new position.
 *   3. The total never exceeds {@link MAX_GEOFENCES}.
 */

import type { LocationRegion } from 'expo-location';

import {
  CANDIDATE_BOUND_RADIUS_M,
  DEFAULT_GEOFENCE_RADIUS_M,
  MAX_GEOFENCES,
} from './constants';
import { distanceMeters } from './geo';
import type { GeofenceCandidate, LatLng } from './types';

const toRegion = (candidate: GeofenceCandidate): LocationRegion => ({
  identifier: candidate.id,
  latitude: candidate.latitude,
  longitude: candidate.longitude,
  radius: candidate.radius ?? DEFAULT_GEOFENCE_RADIUS_M,
  notifyOnEnter: true,
  notifyOnExit: true,
});

/**
 * Choose the geofence regions to register for a user at `center`, applying the
 * pins-first / nearest-mosques-within-radius / capped strategy above.
 */
export function selectRegions(
  candidates: readonly GeofenceCandidate[],
  center: LatLng,
): LocationRegion[] {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      distance: distanceMeters(center, candidate),
    }))
    .sort((a, b) => a.distance - b.distance);

  const pins = ranked.filter(({ candidate }) => candidate.kind === 'pin');
  const mosques = ranked.filter(
    ({ candidate, distance }) =>
      candidate.kind === 'mosque' && distance <= CANDIDATE_BOUND_RADIUS_M,
  );

  const chosen = pins.slice(0, MAX_GEOFENCES);
  const remaining = MAX_GEOFENCES - chosen.length;
  if (remaining > 0) {
    chosen.push(...mosques.slice(0, remaining));
  }

  return chosen.map(({ candidate }) => toRegion(candidate));
}

/**
 * The ids of `regions` whose ring already contains `center` — i.e. the zones the
 * user is standing inside right now.
 *
 * Android evaluates geofences against *location updates*, so on a stationary
 * device an enter transition (even the OS's initial-trigger) can lag for minutes
 * or never arrive — which is exactly the "I dropped a pin where I'm sitting and it
 * never silenced" case. The arming layer already has a position fix, so it uses
 * this to drive the enter itself; the native state machine dedupes it against the
 * OS's own trigger, so seeding is safe (see {@link armGeofencing}).
 */
export function regionsContainingPoint(
  regions: readonly LocationRegion[],
  center: LatLng,
): string[] {
  return regions
    .filter((region) => {
      if (!region.identifier) {
        return false;
      }
      const radius = region.radius ?? DEFAULT_GEOFENCE_RADIUS_M;
      return distanceMeters(center, region) <= radius;
    })
    .map((region) => region.identifier as string);
}
