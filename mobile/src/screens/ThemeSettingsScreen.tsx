/**
 * Appearance settings screen (F-07.3 / FR-7.1).
 *
 * Lets the user choose the app theme — Light, Dark, or System (follow the OS).
 * The choice persists device-locally via [[theme]] (so it survives restarts and
 * works offline) and mirrors up to the backend `DeviceSettings` through the
 * EPIC-07 sync so it follows the user across devices.
 *
 * The options are laid out as a row of tappable cards — an icon above its label
 * — rather than a stacked list, and styled from the app's own green brand palette
 * ({@link ../lib/colors}) so selection reads green, not the navigation blue.
 */

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useColors, useThemedStyles, type ThemeColors } from '../lib/colors';
import {
  THEME_OPTIONS,
  useResolvedScheme,
  useThemePreference,
  type AppTheme,
} from '../lib/theme';

/** The Ionicon that represents each theme, keyed by preference. */
const THEME_ICONS: Record<AppTheme, keyof typeof Ionicons.glyphMap> = {
  light: 'sunny-outline',
  dark: 'moon-outline',
  system: 'phone-portrait-outline',
};

export function ThemeSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [preference, setPreference] = useThemePreference();
  const scheme = useResolvedScheme();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Theme</Text>
      <View style={styles.grid}>
        {THEME_OPTIONS.map(({ key, label }) => {
          const selected = preference === key;
          return (
            <Pressable
              key={key}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => setPreference(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={label}
            >
              <Ionicons
                name={THEME_ICONS[key]}
                size={30}
                color={selected ? colors.brand : colors.textMuted}
              />
              <Text
                style={[styles.cardLabel, selected && styles.cardLabelSelected]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        “System” follows your device’s light/dark setting (currently {scheme}).
        Your choice is saved on this device and synced to your other devices.
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      gap: 12,
      backgroundColor: colors.background,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: colors.textMuted,
      marginTop: 8,
    },
    grid: {
      flexDirection: 'row',
      gap: 12,
    },
    card: {
      flex: 1,
      alignItems: 'center',
      gap: 8,
      paddingVertical: 20,
      paddingHorizontal: 8,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    cardSelected: {
      borderColor: colors.brand,
      backgroundColor: colors.brandTint,
    },
    cardLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
    },
    cardLabelSelected: {
      color: colors.brand,
      fontWeight: '700',
    },
    note: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18,
      marginTop: 8,
    },
  });
