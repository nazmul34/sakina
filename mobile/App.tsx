import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
} from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { armGeofencing } from './src/lib/geofencing';
import { isAutoSilentEnabled } from './src/lib/autoSilentSettings';
import { darkColors, lightColors } from './src/lib/colors';
import { requestInitialPermissions } from './src/lib/permissions';
import { trySyncDeviceSettings } from './src/lib/deviceSettingsSync';
import { trySyncPins } from './src/lib/pinsSync';
import { hydrateTheme, useResolvedScheme } from './src/lib/theme';
import { RootNavigator } from './src/navigation/RootNavigator';

// Navigation themes with the accent pinned to our green brand, so the app chrome
// (header tint, links, active controls) reads green instead of React Navigation's
// default blue.
const navLightTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: lightColors.brand },
};
const navDarkTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, primary: darkColors.brand },
};

export default function App() {
  const scheme = useResolvedScheme();

  useEffect(() => {
    // Load the saved theme preference into memory on launch so the app chrome
    // reflects the user's choice rather than flashing the OS default (F-07.3).
    void hydrateTheme();
  }, []);

  useEffect(() => {
    // First launch after install: proactively ask for notifications + location so
    // the user doesn't have to remember to enable them for prayer times/reminders.
    // Runs once; per-feature prompts handle anything left undecided afterwards.
    void requestInitialPermissions();
  }, []);

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
      <NavigationContainer theme={scheme === 'dark' ? navDarkTheme : navLightTheme}>
        <RootNavigator />
      </NavigationContainer>
      {/* Pin the status-bar contrast to the resolved scheme (not 'auto') so a
          user-pinned theme that differs from the OS still reads correctly. */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
    </SafeAreaProvider>
  );
}
