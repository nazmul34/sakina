import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { Pressable } from 'react-native';

import { useColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { DailyMessageScreen } from '../screens/DailyMessageScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NearbyMosquesScreen } from '../screens/NearbyMosquesScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import type { MainTabParamList, RootStackParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * A header action that pushes a detail screen onto the root stack. It reads the
 * globally-typed root navigation via `useNavigation()` (rather than the tab
 * options' navigation, which only knows tab routes) so it can target any
 * {@link RootStackParamList} screen.
 */
function HeaderIconButton({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: keyof RootStackParamList;
}) {
  const navigation = useNavigation();
  const c = useColors();
  return (
    <Pressable
      onPress={() => navigation.navigate(route)}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{ paddingHorizontal: 16 }}
    >
      <Ionicons name={icon} size={22} color={c.brand} />
    </Pressable>
  );
}

// Per-tab Ionicons, picked filled when focused and outlined when not — the
// platform-standard cue for the active destination.
const ICONS: Record<
  keyof MainTabParamList,
  { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }
> = {
  Home: { active: 'home', inactive: 'home-outline' },
  Mosques: { active: 'location', inactive: 'location-outline' },
  Messages: { active: 'book', inactive: 'book-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

/**
 * The four primary destinations as a bottom tab bar. Deep/focused screens live
 * in the surrounding root stack and push over these tabs (see
 * {@link ./RootNavigator}). Home owns its own hero, so its header is hidden; the
 * other tabs use the standard themed header.
 */
export function MainTabs() {
  const c = useColors();
  const t = useT();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: c.brand,
        tabBarInactiveTintColor: c.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarIcon: ({ color, size, focused }) => {
          const icon = ICONS[route.name];
          return (
            <Ionicons
              name={focused ? icon.active : icon.inactive}
              size={size}
              color={color}
            />
          );
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false, title: t('tab.home') }}
      />
      <Tab.Screen
        name="Mosques"
        component={NearbyMosquesScreen}
        options={{
          title: t('tab.mosques'),
          // Quick hop to the user's custom silencing zones — the other
          // location-based feature, otherwise only in Settings.
          headerRight: () => (
            <HeaderIconButton
              icon="pin-outline"
              label={t('nav.pinnedZones')}
              route="PinnedLocations"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Messages"
        component={DailyMessageScreen}
        options={{
          title: t('tab.messages'),
          headerRight: () => (
            <HeaderIconButton
              icon="heart-outline"
              label={t('nav.savedMessages')}
              route="SavedMessages"
            />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: t('tab.settings') }}
      />
    </Tab.Navigator>
  );
}
