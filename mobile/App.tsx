import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { armGeofencing } from './src/lib/geofencing';
import { isAutoSilentEnabled } from './src/lib/autoSilentSettings';
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

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}
