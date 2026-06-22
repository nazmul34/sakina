/**
 * Qibla compass screen (FR-6.1, EPIC-06).
 *
 * Shows a live compass whose needle points toward the Kaaba in Mecca. It takes
 * a one-shot high-accuracy fix ({@link getHighAccuracyFix}) to compute the
 * absolute Qibla bearing ({@link qiblaBearing}), subscribes to the device
 * heading ({@link useDeviceHeading}), and rotates the needle by
 * {@link qiblaRotation} so it keeps pointing at the Kaaba as the phone turns.
 *
 * Calibration prompts (F-06.2) and a richer no-magnetometer fallback (F-06.3)
 * are tracked separately; this screen handles the happy path plus the basic
 * "no sensor / no location permission" messages so it never crashes.
 */

import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useDeviceHeading } from '../hooks/useDeviceHeading';
import type { LatLng } from '../lib/geofencing/types';
import { getHighAccuracyFix, LocationPermissionError } from '../lib/location';
import { compassPointName, qiblaBearing, qiblaRotation } from '../lib/qibla';

type LocationState =
  | { status: 'loading' }
  | { status: 'ready'; location: LatLng }
  | { status: 'denied' }
  | { status: 'error' };

export function QiblaScreen() {
  const navigation = useNavigation();
  const [locationState, setLocationState] = useState<LocationState>({
    status: 'loading',
  });
  const { heading, isAvailable, needsCalibration } = useDeviceHeading();

  useEffect(() => {
    let active = true;

    getHighAccuracyFix()
      .then((location) => {
        if (active) {
          setLocationState({ status: 'ready', location });
        }
      })
      .catch((err: unknown) => {
        if (!active) {
          return;
        }
        setLocationState({
          status:
            err instanceof LocationPermissionError ? 'denied' : 'error',
        });
      });

    return () => {
      active = false;
    };
  }, []);

  if (locationState.status === 'denied') {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Location needed</Text>
        <Text style={styles.centeredBody}>
          Allow location access so Sakina can work out which way the Qibla is
          from where you are.
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Permissions')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Set up permissions</Text>
        </Pressable>
      </View>
    );
  }

  if (locationState.status === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>Couldn&apos;t find you</Text>
        <Text style={styles.centeredBody}>
          We couldn&apos;t get your location to compute the Qibla. Please try
          again.
        </Text>
      </View>
    );
  }

  if (locationState.status === 'loading' || isAvailable === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.centeredBody}>Finding the Qibla…</Text>
      </View>
    );
  }

  const bearing = qiblaBearing(locationState.location);
  const point = compassPointName(bearing);

  // No magnetometer (F-06.3): the needle can't track the device, so show a
  // static North-up dial with the Qibla fixed at its true bearing, plus the
  // direction in words. Still useful — the user lines it up against north
  // themselves — and we say plainly why it isn't live.
  if (isAvailable === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>Qibla</Text>
        <Text style={styles.subtitle}>
          Face <Text style={styles.bold}>{point}</Text> —{' '}
          {Math.round(bearing)}° from north.
        </Text>

        <View style={styles.dial}>
          <Text style={[styles.cardinal, styles.north]}>N</Text>
          <Text style={[styles.cardinal, styles.east]}>E</Text>
          <Text style={[styles.cardinal, styles.south]}>S</Text>
          <Text style={[styles.cardinal, styles.west]}>W</Text>
          <View
            style={[styles.needle, { transform: [{ rotate: `${bearing}deg` }] }]}
            accessibilityLabel={`Qibla is ${Math.round(bearing)} degrees from north, to the ${point}`}
          >
            <Text style={styles.needleArrow}>↑</Text>
          </View>
        </View>

        <View style={styles.calibrationBanner}>
          <Text style={styles.calibrationTitle}>No live compass</Text>
          <Text style={styles.calibrationBody}>
            This device has no magnetometer, so the arrow can&apos;t turn as you
            move. Orient yourself to north, then face the arrow.
          </Text>
        </View>
      </View>
    );
  }

  // Until the first reading lands, point the needle straight up (rotation 0).
  const rotation = heading == null ? 0 : qiblaRotation(bearing, heading);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Qibla</Text>
      <Text style={styles.subtitle}>Turn until the arrow points up.</Text>

      {needsCalibration === true && (
        <View
          style={styles.calibrationBanner}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          <Text style={styles.calibrationTitle}>Compass needs calibrating</Text>
          <Text style={styles.calibrationBody}>
            Readings look off — move away from metal or magnets and wave your
            phone in a figure-8 a few times. This message clears once the
            compass settles.
          </Text>
        </View>
      )}

      <View style={styles.dial}>
        <Text style={[styles.cardinal, styles.north]}>N</Text>
        <Text style={[styles.cardinal, styles.east]}>E</Text>
        <Text style={[styles.cardinal, styles.south]}>S</Text>
        <Text style={[styles.cardinal, styles.west]}>W</Text>
        <View
          style={[styles.needle, { transform: [{ rotate: `${rotation}deg` }] }]}
          accessibilityLabel={`Qibla is ${Math.round(bearing)} degrees from north`}
        >
          <Text style={styles.needleArrow}>↑</Text>
        </View>
      </View>

      <Text style={styles.readout}>{Math.round(bearing)}° from north</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.7,
  },
  dial: {
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 2,
    borderColor: '#C7D2DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  cardinal: {
    position: 'absolute',
    fontSize: 15,
    fontWeight: '700',
    opacity: 0.5,
  },
  north: { top: 10 },
  south: { bottom: 10 },
  east: { right: 12 },
  west: { left: 12 },
  needle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  needleArrow: {
    fontSize: 120,
    lineHeight: 130,
    color: '#1E7A46',
  },
  readout: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.8,
  },
  calibrationBanner: {
    alignSelf: 'stretch',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FFF8E1',
    gap: 4,
  },
  calibrationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8A6D00',
  },
  calibrationBody: {
    fontSize: 13,
    color: '#8A6D00',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  centeredBody: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  bold: {
    fontWeight: '700',
    opacity: 1,
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
