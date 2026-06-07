import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import RingerControl, { type RingerMode } from '../../modules/ringer-control';

const MODES: RingerMode[] = ['silent', 'vibrate', 'normal'];

/**
 * Dev-only panel that exercises every method of the native `RingerControl`
 * module — a manual harness for the F-00.2 acceptance criteria. Real
 * auto-silent UI replaces this once EPIC-01 lands.
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

  const refresh = useCallback(() => {
    setDndGranted(RingerControl.isDndAccessGranted());
    setRingerModeState(RingerControl.getRingerMode());
    setDeviceId(RingerControl.getDeviceId());
  }, []);

  const applyMode = useCallback((mode: RingerMode) => {
    try {
      RingerControl.setRingerMode(mode);
      setRingerModeState(RingerControl.getRingerMode());
    } catch (error) {
      Alert.alert('Could not change ringer', String(error));
    }
  }, []);

  return (
    <View style={styles.panel}>
      <Text style={styles.heading}>RingerControl (dev)</Text>
      <Text style={styles.row}>Device ID: {deviceId}</Text>
      <Text style={styles.row}>
        DND access: {dndGranted ? 'granted' : 'not granted'}
      </Text>
      <Text style={styles.row}>Ringer mode: {ringerMode}</Text>

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
