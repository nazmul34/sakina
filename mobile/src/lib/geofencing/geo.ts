/**
 * Tiny geospatial helpers. Pure functions, no Expo imports — easy to unit-test
 * and reuse from the selection logic and the movement-threshold check.
 */

import type { LatLng } from './types';

const EARTH_RADIUS_M = 6_371_000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/**
 * Great-circle distance in metres between two coordinates (haversine). Accurate
 * to well within a metre at city scale, which is all the geofence selection and
 * re-registration thresholds need.
 */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Initial great-circle bearing from `from` to `to`, in degrees clockwise from
 * true north (0 = N, 90 = E, 180 = S, 270 = W), normalised to [0, 360). Used to
 * show which way a nearby mosque lies (FR-2.4).
 */
export function bearingDegrees(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}
