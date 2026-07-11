/**
 * Language settings screen.
 *
 * Lets the user choose the app language — English or Bangla. The choice persists
 * device-locally via [[i18n/locale]] (survives restarts, works offline) and takes
 * effect app-wide immediately through the locale pub-sub, so every screen
 * re-renders in the new language without a restart.
 *
 * Laid out as a row of tappable cards, styled from the app's green brand palette,
 * mirroring {@link ./ThemeSettingsScreen}.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { LOCALE_OPTIONS, useLocalePreference, useT } from '../lib/i18n';

export function LanguageSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const [preference, setPreference] = useLocalePreference();
  const t = useT();

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>{t('language.section')}</Text>
      <View style={styles.grid}>
        {LOCALE_OPTIONS.map(({ key, native }) => {
          const selected = preference === key;
          return (
            <Pressable
              key={key}
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => setPreference(key)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={native}
            >
              <Text
                style={[styles.cardLabel, selected && styles.cardLabelSelected]}
              >
                {native}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>{t('language.note')}</Text>
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
      fontSize: 18,
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
