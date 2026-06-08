import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { RingerControlPanel } from '../components/RingerControlPanel';
import { API_BASE_URL } from '../config/env';
import { apiFetch } from '../lib/api';
import { getDeviceId } from '../lib/deviceId';

/**
 * Placeholder home screen for the scaffold. Real feature UI (prayer times,
 * nearby mosques, auto-silent status, etc.) replaces this later.
 */
export function HomeScreen() {
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
});
