import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import RingerControl, { type RingerMode } from '../../modules/ringer-control';

const MODES: RingerMode[] = ['silent', 'vibrate', 'normal'];

/** Synthetic region id used by the manual zone-trigger buttons. */
const TEST_ZONE = 'test-zone';

/**
 * Dev/QA panel that exercises the native `RingerControl` module directly — a
 * manual harness for the F-00.2 ringer primitives and, via the zone Enter/Exit
 * buttons, the full F-01.3/1.4/1.5/1.8/1.9 state machine without needing real
 * geofence data (EPIC-02/03) or physical movement. Real auto-silent UI replaces
 * this later.
 *
 * The Enter/Exit buttons feed the same `onZoneEnter`/`onZoneExit` seam the
 * background geofencing task uses, so they drive the genuine dwell → silence →
 * exit-buffer → restore flow (and its activity log + failure warnings), just on
 * demand instead of from GPS.
 */
export function RingerControlPanel() {
  // The native getters are synchronous, so we can seed state lazily on first
  // render rather than syncing it from an effect.
  const [deviceId, setDeviceId] = useState(() => RingerControl.getDeviceId());
  const [dndGranted, setDndGranted] = useState(() =>
    RingerControl.isDndAccessGranted(),
  );
  const [ringerMode, setRingerModeState] = useState<RingerMode>(() =>
    RingerControl.getRingerMode(),
  );
  const [activeZones, setActiveZones] = useState(() =>
    RingerControl.activeZoneCount(),
  );

  const refresh = useCallback(() => {
    setDndGranted(RingerControl.isDndAccessGranted());
    setRingerModeState(RingerControl.getRingerMode());
    setDeviceId(RingerControl.getDeviceId());
    setActiveZones(RingerControl.activeZoneCount());
  }, []);

  const applyMode = useCallback((mode: RingerMode) => {
    try {
      RingerControl.setRingerMode(mode);
      setRingerModeState(RingerControl.getRingerMode());
    } catch (error) {
      Alert.alert('Could not change ringer', String(error));
    }
  }, []);

  const enterZone = useCallback(() => {
    setActiveZones(RingerControl.onZoneEnter(TEST_ZONE));
  }, []);

  const exitZone = useCallback(() => {
    setActiveZones(RingerControl.onZoneExit(TEST_ZONE));
  }, []);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>RingerControl (dev)</Text>
      <Text style={styles.row}>Device ID: {deviceId}</Text>
      <Text style={styles.row}>
        DND access: {dndGranted ? 'granted' : 'not granted'}
      </Text>
      <Text style={styles.row}>Ringer mode: {ringerMode}</Text>
      <Text style={styles.row}>Active zones: {activeZones}</Text>

      <View style={styles.buttons}>
        {MODES.map((mode) => (
          <Pressable
            key={mode}
            style={styles.button}
            onPress={() => applyMode(mode)}
          >
            <Text style={styles.buttonText}>{mode}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buttons}>
        <Pressable style={styles.button} onPress={enterZone}>
          <Text style={styles.buttonText}>Enter zone</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={exitZone}>
          <Text style={styles.buttonText}>Exit zone</Text>
        </Pressable>
      </View>

      <View style={styles.buttons}>
        <Pressable
          style={styles.button}
          onPress={() => RingerControl.openDndSettings()}
        >
          <Text style={styles.buttonText}>Open DND settings</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={refresh}>
          <Text style={styles.buttonText}>Refresh</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    gap: 6,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  row: {
    fontSize: 13,
    opacity: 0.8,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E6F4FE',
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
