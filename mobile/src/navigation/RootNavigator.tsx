import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActivityScreen } from '../screens/ActivityScreen';
import { DailyReminderScreen } from '../screens/DailyReminderScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { PinEditorScreen } from '../screens/PinEditorScreen';
import { PinnedLocationsScreen } from '../screens/PinnedLocationsScreen';
import { PrayerSettingsScreen } from '../screens/PrayerSettingsScreen';
import { QiblaScreen } from '../screens/QiblaScreen';
import { SavedMessagesScreen } from '../screens/SavedMessagesScreen';
import { ThemeSettingsScreen } from '../screens/ThemeSettingsScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation stack. `MainTabs` is the home host (bottom tab bar); every
 * other screen is a focused detail flow that pushes over the tabs with a back
 * button. Sharing one stack means cross-tab links (`navigate('Qibla')`, etc.)
 * resolve from anywhere.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Permissions"
        component={PermissionsScreen}
        options={{ title: 'Permissions' }}
      />
      <Stack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: 'Activity' }}
      />
      <Stack.Screen
        name="PinnedLocations"
        component={PinnedLocationsScreen}
        options={{ title: 'Pinned zones' }}
      />
      <Stack.Screen
        name="PinEditor"
        component={PinEditorScreen}
        options={{ title: 'Pin a location' }}
      />
      <Stack.Screen
        name="SavedMessages"
        component={SavedMessagesScreen}
        options={{ title: 'Saved messages' }}
      />
      <Stack.Screen
        name="DailyReminder"
        component={DailyReminderScreen}
        options={{ title: 'Daily reminder' }}
      />
      <Stack.Screen
        name="PrayerSettings"
        component={PrayerSettingsScreen}
        options={{ title: 'Prayer times' }}
      />
      <Stack.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{ title: 'Qibla' }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ title: 'Appearance' }}
      />
    </Stack.Navigator>
  );
}
