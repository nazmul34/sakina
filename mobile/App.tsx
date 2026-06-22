import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { armGeofencing } from './src/lib/geofencing';
import { isAutoSilentEnabled } from './src/lib/autoSilentSettings';
import { trySyncDeviceSettings } from './src/lib/deviceSettingsSync';
import { trySyncPins } from './src/lib/pinsSync';
import { RootNavigator } from './src/navigation/RootNavigator';

export default function App() {
  useEffect(() => {
    // Re-arm geofences on launch if auto-silent is on. Geofences persist across
    // app-kill/reboot on their own, but re-selecting on launch keeps the set
    // current with the user's location and any candidate changes (F-01.2).
    if (isAutoSilentEnabled()) {
      void armGeofencing();
    }
  }, []);

  useEffect(() => {
    // Reconcile pinned zones (F-03.2) and device settings (F-07.2) on launch and
    // whenever the app returns to the foreground. Both are best-effort and
    // offline-safe — failures are swallowed and local edits sync on the next
    // opportunity.
    const syncAll = () => {
      void trySyncPins();
      void trySyncDeviceSettings();
    };
    syncAll();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncAll();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
