import { StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL } from '../config/env';

/**
 * Placeholder home screen for the scaffold. Real feature UI (prayer times,
 * nearby mosques, auto-silent status, etc.) replaces this later.
 */
export function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sakina</Text>
      <Text style={styles.subtitle}>
        Your phone, respectful around mosques and during prayer.
      </Text>
      <Text style={styles.meta}>API: {API_BASE_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  meta: {
    fontSize: 12,
    opacity: 0.5,
  },
});
