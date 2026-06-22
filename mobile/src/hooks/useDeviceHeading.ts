/**
 * Live device compass heading from the magnetometer (FR-6.1, FR-6.2).
 *
 * Subscribes to `expo-sensors` Magnetometer updates and converts each reading
 * to a heading in degrees clockwise from magnetic north (see
 * {@link headingFromMagnetometer}). The Qibla compass screen combines this with
 * the absolute Qibla bearing so its indicator tracks the Kaaba as the phone
 * turns.
 *
 * It also watches the field strength as a proxy for sensor accuracy and exposes
 * `needsCalibration` (FR-6.2): `expo-sensors` doesn't surface the OS accuracy
 * flag, so a field magnitude outside Earth's plausible band signals
 * interference or an uncalibrated sensor. The verdict carries hysteresis (see
 * {@link isFieldStrengthReliable}) so the calibration prompt doesn't flicker.
 *
 * `isAvailable` starts `null` (unknown, still probing) and resolves to a
 * boolean once the sensor check completes — letting the screen show a spinner
 * before deciding, and giving the no-magnetometer fallback (F-06.3) a hook to
 * build on. The subscription is torn down on unmount so the sensor doesn't keep
 * running in the background.
 */

import { Magnetometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';

import {
  headingFromMagnetometer,
  isFieldStrengthReliable,
  magneticFieldStrength,
} from '../lib/qibla';

/** ~16 updates/sec — smooth needle motion without spamming re-renders. */
const UPDATE_INTERVAL_MS = 60;

export interface DeviceHeading {
  /** Heading in degrees clockwise from magnetic north, or `null` before the first reading. */
  readonly heading: number | null;
  /** Whether the device has a magnetometer; `null` while still probing. */
  readonly isAvailable: boolean | null;
  /** Whether readings look unreliable and the sensor should be calibrated; `null` before the first reading. */
  readonly needsCalibration: boolean | null;
}

export function useDeviceHeading(): DeviceHeading {
  const [heading, setHeading] = useState<number | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [needsCalibration, setNeedsCalibration] = useState<boolean | null>(
    null,
  );
  // Previous reliability verdict, kept in a ref so the hysteresis in
  // isFieldStrengthReliable can read it without re-subscribing each reading.
  // Optimistic start: assume reliable until a reading says otherwise.
  const reliableRef = useRef(true);

  useEffect(() => {
    let active = true;
    let subscription: ReturnType<typeof Magnetometer.addListener> | null = null;

    Magnetometer.isAvailableAsync()
      .then((available) => {
        if (!active) {
          return;
        }
        setIsAvailable(available);
        if (!available) {
          return;
        }
        Magnetometer.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = Magnetometer.addListener((reading) => {
          setHeading(headingFromMagnetometer(reading));

          const reliable = isFieldStrengthReliable(
            magneticFieldStrength(reading),
            reliableRef.current,
          );
          // setState is a no-op (no re-render) when the boolean is unchanged.
          reliableRef.current = reliable;
          setNeedsCalibration(!reliable);
        });
      })
      .catch(() => {
        if (active) {
          setIsAvailable(false);
        }
      });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  return { heading, isAvailable, needsCalibration };
}
