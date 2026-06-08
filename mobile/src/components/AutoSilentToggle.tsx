import { StyleSheet, Switch, Text, View } from 'react-native';

import { useAutoSilentEnabled } from '../lib/autoSilentSettings';

/**
 * Master on/off switch for the auto-silent flagship (FR-1.1). When on, the
 * device arms mosque/zone monitoring; when off, no geofences are registered and
 * no foreground service runs. The choice persists across restarts and reboots —
 * see {@link useAutoSilentEnabled}.
 */
export function AutoSilentToggle() {
  const [enabled, setEnabled] = useAutoSilentEnabled();

  return (
    <View style={styles.card}>
      <View style={styles.text}>
        <Text style={styles.title}>Auto-silent</Text>
        <Text style={styles.subtitle}>
          Silence your phone automatically near mosques and during prayer.
        </Text>
      </View>
      <Switch value={enabled} onValueChange={setEnabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
});
