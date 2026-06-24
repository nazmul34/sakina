/**
 * Appearance settings screen (F-07.3 / FR-7.1).
 *
 * Lets the user choose the app theme — Light, Dark, or System (follow the OS).
 * The choice persists device-locally via [[theme]] (so it survives restarts and
 * works offline) and mirrors up to the backend `DeviceSettings` through the
 * EPIC-07 sync so it follows the user across devices. The screen styles itself
 * from the active React Navigation theme, so the preview reflects the choice
 * immediately.
 */

import { useTheme } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { THEME_OPTIONS, useResolvedScheme, useThemePreference } from '../lib/theme';

export function ThemeSettingsScreen() {
  const [preference, setPreference] = useThemePreference();
  const scheme = useResolvedScheme();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Theme</Text>
      <View style={[styles.group, { borderColor: colors.border }]}>
        {THEME_OPTIONS.map(({ key, label }) => {
          const selected = preference === key;
          return (
            <Pressable
              key={key}
              style={[
                styles.option,
                { borderBottomColor: colors.border },
                selected && { backgroundColor: colors.primary + '22' },
              ]}
              onPress={() => setPreference(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { color: colors.text },
                  selected && styles.optionLabelSelected,
                ]}
              >
                {label}
              </Text>
              {selected && (
                <Text style={[styles.check, { color: colors.primary }]}>✓</Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.note, { color: colors.text }]}>
        “System” follows your device’s light/dark setting (currently {scheme}).
        Your choice is saved on this device and synced to your other devices.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.55,
    marginTop: 8,
  },
  group: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionLabel: {
    fontSize: 16,
  },
  optionLabelSelected: {
    fontWeight: '700',
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    opacity: 0.6,
    lineHeight: 18,
    marginTop: 8,
  },
});
