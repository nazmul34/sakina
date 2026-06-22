import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActivityScreen } from '../screens/ActivityScreen';
import { DailyMessageScreen } from '../screens/DailyMessageScreen';
import { DailyReminderScreen } from '../screens/DailyReminderScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyMosquesScreen } from '../screens/NearbyMosquesScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { PinEditorScreen } from '../screens/PinEditorScreen';
import { PinnedLocationsScreen } from '../screens/PinnedLocationsScreen';
import { PrayerSettingsScreen } from '../screens/PrayerSettingsScreen';
import { SavedMessagesScreen } from '../screens/SavedMessagesScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root navigation stack. Currently a single placeholder Home screen;
 * feature screens get added here as they land.
 */
export function RootNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Sakina' }}
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
        name="NearbyMosques"
        component={NearbyMosquesScreen}
        options={{ title: 'Nearby mosques' }}
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
        name="DailyMessage"
        component={DailyMessageScreen}
        options={{ title: 'Daily message' }}
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
    </Stack.Navigator>
  );
}
