/**
 * Qibla direction math (FR-6.1, EPIC-06).
 *
 * The Qibla is the direction of the Kaaba in Mecca, which Muslims face in
 * prayer. From anywhere on Earth it's the initial great-circle bearing from the
 * user's coordinates to the Kaaba — the same compass-bearing math the
 * nearby-mosque arrows already use ({@link bearingDegrees}), just with a fixed
 * destination. Keeping this pure and side-effect-free (no sensors, no network)
 * mirrors {@link ./prayerTimes} and lets the compass screen and any tests build
 * on one source of truth.
 *
 * The live device heading comes from the magnetometer via
 * {@link ../hooks/useDeviceHeading}; this module only does geometry.
 */

import { bearingDegrees } from './geofencing/geo';
import type { LatLng } from './geofencing/types';

/**
 * The Kaaba's coordinates (Masjid al-Haram, Mecca). The Qibla everywhere on
 * Earth is computed relative to this single point.
 */
export const KAABA: LatLng = {
  latitude: 21.4225,
  longitude: 39.8262,
};

/**
 * The Qibla bearing from a location, in degrees clockwise from true north
 * (0 = N, 90 = E, …), normalised to [0, 360). This is the absolute compass
 * direction of the Kaaba — independent of which way the device is pointing.
 */
export function qiblaBearing(from: LatLng): number {
  return bearingDegrees(from, KAABA);
}

/**
 * Device heading from a raw magnetometer reading, in degrees clockwise from
 * magnetic north, normalised to [0, 360).
 *
 * Held flat, the device's heading is `atan2(y, x)` over the horizontal field
 * components — the sensor frame has x to the device's right and y toward its
 * top, so this is the angle of the field relative to the top edge. This is an
 * *uncalibrated* magnetic heading: it ignores declination (magnetic vs true
 * north differs by a few degrees regionally) and device tilt, both acceptable
 * for orienting toward the Qibla. Improving accuracy when the sensor is noisy
 * is calibration (F-06.2); the no-magnetometer case is F-06.3.
 */
export function headingFromMagnetometer(reading: {
  x: number;
  y: number;
}): number {
  const degrees = Math.atan2(reading.y, reading.x) * (180 / Math.PI);
  return (degrees + 360) % 360;
}

/**
 * Plausible band for Earth's magnetic field strength at the surface, in
 * microteslas. A reading well outside this range means local magnetic
 * interference or an uncalibrated sensor, so the heading can't be trusted —
 * our cue to prompt for calibration (FR-6.2).
 *
 * `expo-sensors` doesn't surface the OS sensor-accuracy flag, so the total
 * field magnitude is the best proxy we have: a healthy reading sits in roughly
 * 25–65 μT regardless of orientation.
 */
export const FIELD_STRENGTH_MIN_UT = 25;
export const FIELD_STRENGTH_MAX_UT = 65;

/**
 * Hysteresis margin (μT) applied when recovering. Once we've flagged the sensor
 * unreliable, the field must return *well* inside the band before we clear the
 * prompt, so it doesn't flicker on readings that hover at a threshold.
 */
const FIELD_STRENGTH_RECOVERY_MARGIN_UT = 3;

/** Total magnetic field strength of a reading, in microteslas. */
export function magneticFieldStrength(reading: {
  x: number;
  y: number;
  z: number;
}): number {
  return Math.hypot(reading.x, reading.y, reading.z);
}

/**
 * Decide whether the magnetometer reading is reliable, given the previous
 * verdict, using field strength as a proxy for accuracy (FR-6.2).
 *
 * Asymmetric by design: we flag *unreliable* the moment strength leaves the
 * plausible band, but only call it reliable again once it's back inside the
 * band by {@link FIELD_STRENGTH_RECOVERY_MARGIN_UT}. That hysteresis keeps the
 * calibration prompt from blinking on and off near the edges.
 */
export function isFieldStrengthReliable(
  strengthUT: number,
  wasReliable: boolean,
): boolean {
  if (wasReliable) {
    return (
      strengthUT >= FIELD_STRENGTH_MIN_UT && strengthUT <= FIELD_STRENGTH_MAX_UT
    );
  }
  return (
    strengthUT >= FIELD_STRENGTH_MIN_UT + FIELD_STRENGTH_RECOVERY_MARGIN_UT &&
    strengthUT <= FIELD_STRENGTH_MAX_UT - FIELD_STRENGTH_RECOVERY_MARGIN_UT
  );
}

/**
 * How far to rotate a fixed "points at Qibla" indicator given the absolute
 * Qibla bearing and the device's current heading, in degrees clockwise,
 * normalised to [0, 360).
 *
 * When the device's top edge points straight at the Qibla (`heading` equals
 * `bearing`) this is 0, so an upward-drawn arrow needs no rotation. As the user
 * turns the phone, the indicator counter-rotates to keep pointing at the Kaaba.
 */
export function qiblaRotation(bearing: number, heading: number): number {
  return ((bearing - heading) % 360 + 360) % 360;
}

/** The 8 compass points, clockwise from north. */
const COMPASS_POINTS = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
] as const;

/**
 * The nearest of the 8 compass points to a bearing in degrees (0 = N), e.g.
 * `200` → `'SW'`. Used to spell out a direction in words — for the
 * no-magnetometer fallback (F-06.3), where there's no live needle to follow.
 */
export function compassPointName(bearing: number): string {
  return COMPASS_POINTS[Math.round(bearing / 45) % 8];
}
