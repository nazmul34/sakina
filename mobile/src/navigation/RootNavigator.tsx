import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useT } from '../lib/i18n';
import { ActivityScreen } from '../screens/ActivityScreen';
import { DailyReminderScreen } from '../screens/DailyReminderScreen';
import { LanguageSettingsScreen } from '../screens/LanguageSettingsScreen';
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
  const t = useT();
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
        options={{ title: t('nav.permissions') }}
      />
      <Stack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: t('nav.activity') }}
      />
      <Stack.Screen
        name="PinnedLocations"
        component={PinnedLocationsScreen}
        options={{ title: t('nav.pinnedZones') }}
      />
      <Stack.Screen
        name="PinEditor"
        component={PinEditorScreen}
        options={{ title: t('nav.pinLocation') }}
      />
      <Stack.Screen
        name="SavedMessages"
        component={SavedMessagesScreen}
        options={{ title: t('nav.savedMessages') }}
      />
      <Stack.Screen
        name="DailyReminder"
        component={DailyReminderScreen}
        options={{ title: t('nav.dailyReminder') }}
      />
      <Stack.Screen
        name="PrayerSettings"
        component={PrayerSettingsScreen}
        options={{ title: t('nav.prayerTimes') }}
      />
      <Stack.Screen
        name="Qibla"
        component={QiblaScreen}
        options={{ title: t('nav.qibla') }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ title: t('nav.appearance') }}
      />
      <Stack.Screen
        name="LanguageSettings"
        component={LanguageSettingsScreen}
        options={{ title: t('nav.language') }}
      />
    </Stack.Navigator>
  );
}
