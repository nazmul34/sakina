import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AutoSilentToggle } from '../components/AutoSilentToggle';
import { RingerControlPanel } from '../components/RingerControlPanel';
import { API_BASE_URL } from '../config/env';
import { apiFetch } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';

/**
 * Placeholder home screen for the scaffold. Real feature UI (prayer times,
 * nearby mosques, auto-silent status, etc.) replaces this later.
 */
export function HomeScreen() {
  const navigation = useNavigation();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    // Resolve the device ID for display and ping the backend so the server
    // upserts a Device row on first contact (F-00.4). The X-Device-Id header
    // is attached by apiFetch; failures are non-fatal (e.g. backend offline).
    getDeviceId().then((id) => {
      if (active) {
        setDeviceId(id);
      }
    });
    apiFetch('/health').catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sakina</Text>
      <Text style={styles.subtitle}>
        Your phone, respectful around mosques and during prayer.
      </Text>
      <Text style={styles.meta}>API: {API_BASE_URL}</Text>
      <Text style={styles.meta}>Device: {deviceId ?? '…'}</Text>
      <AutoSilentToggle />
      <Pressable
        style={styles.permissionsLink}
        onPress={() => navigation.navigate('NearbyMosques')}
        accessibilityRole="button"
      >
        <Text style={styles.permissionsLinkText}>Nearby mosques</Text>
      </Pressable>
      <Pressable
        style={styles.permissionsLink}
        onPress={() => navigation.navigate('Permissions')}
        accessibilityRole="button"
      >
        <Text style={styles.permissionsLinkText}>Set up permissions</Text>
      </Pressable>
      <Pressable
        style={styles.permissionsLink}
        onPress={() => navigation.navigate('Activity')}
        accessibilityRole="button"
      >
        <Text style={styles.permissionsLinkText}>Activity log</Text>
      </Pressable>
      <RingerControlPanel />
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
  permissionsLink: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
  },
  permissionsLinkText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
