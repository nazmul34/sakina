import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { useColors, useThemedStyles, type ThemeColors } from '../lib/colors';
import {
  useAutoSilentEnabled,
  useSilenceMode,
} from '../lib/autoSilentSettings';

/**
 * Master on/off switch for the auto-silent flagship (FR-1.1) plus the choice of
 * what "quiet" means (FR-1.3): fully silent, or vibrate. When on, the device
 * arms mosque/zone monitoring and, on entry, switches to the selected mode; when
 * off, no geofences are registered and no foreground service runs. Both the
 * toggle and the mode persist across restarts and reboots — see
 * {@link useAutoSilentEnabled} / {@link useSilenceMode}.
 */
export function AutoSilentToggle() {
  const styles = useThemedStyles(makeStyles);
  const [enabled, setEnabled] = useAutoSilentEnabled();
  const [mode, setMode] = useSilenceMode();

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.text}>
          <Text style={styles.title}>Auto-quiet</Text>
          <Text style={styles.subtitle}>
            Quiet your phone automatically near mosques and during prayer.
          </Text>
        </View>
        <Switch value={enabled} onValueChange={setEnabled} />
      </View>

      {enabled && (
        <View style={styles.modeRow} accessibilityRole="radiogroup">
          <ModeOption
            label="Silent"
            icon="notifications-off-outline"
            selected={mode === 'silent'}
            onPress={() => setMode('silent')}
          />
          <ModeOption
            label="Vibrate"
            icon="phone-portrait-outline"
            selected={mode === 'vibrate'}
            onPress={() => setMode('vibrate')}
          />
        </View>
      )}
    </View>
  );
}

function ModeOption({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  selected: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={[styles.modeOption, selected && styles.modeOptionSelected]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={18}
        color={selected ? c.brand : c.textMuted}
      />
      <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    gap: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  modeOptionSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  modeLabelSelected: {
    color: colors.brand,
  },
});
