/**
 * Location display for the home header (F-07.4 / FR-5.1).
 *
 * Shows a short, reverse-geocoded place name for where the user is (e.g.
 * "London, England"), resolved on-device and cached so it stays populated
 * offline — see {@link ../lib/placeName}. Renders nothing until a name is
 * available (cached or fresh), so the header never shows an empty pin. Styled
 * from the active navigation theme so it follows the Light/Dark choice (F-07.3).
 */

import { useTheme } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';

import { useLocale } from '../lib/i18n';
import { localizePlaceLabel } from '../lib/i18n/bdPlaces';
import { usePlaceName } from '../lib/placeName';

export function LocationHeader() {
  const name = usePlaceName();
  const locale = useLocale();
  const { colors } = useTheme();

  if (!name) {
    return null;
  }

  // Translate BD place names to Bangla when the app language is Bangla (the OS
  // geocoder only returns them in the device locale). Reactive to the locale, so
  // switching language re-localizes the header without re-resolving the fix.
  const display = localizePlaceLabel(name, locale);

  return (
    <View style={styles.container} accessibilityRole="text">
      <Text style={[styles.pin, { color: colors.primary }]}>📍</Text>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pin: {
    fontSize: 14,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
});
