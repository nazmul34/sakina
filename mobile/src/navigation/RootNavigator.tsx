import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ActivityScreen } from '../screens/ActivityScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyMosquesScreen } from '../screens/NearbyMosquesScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';
import { PinEditorScreen } from '../screens/PinEditorScreen';
import { PinnedLocationsScreen } from '../screens/PinnedLocationsScreen';
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
    </Stack.Navigator>
  );
}
