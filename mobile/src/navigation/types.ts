import type { NavigatorScreenParams } from '@react-navigation/native';

/**
 * Navigation shape.
 *
 * The app is organised around a bottom **tab bar** ({@link MainTabParamList})
 * with four primary destinations. Deeper, task-focused screens (editors, lists,
 * settings detail) live in the surrounding **root stack**
 * ({@link RootStackParamList}) and push *over* the tabs, hiding the bar while the
 * user is in a focused flow. Because every leaf screen shares one root stack,
 * `navigation.navigate('Qibla')` etc. resolves from anywhere — calls bubble up
 * from the tab navigator to the parent stack.
 *
 * Adding a screen here gives every navigator/route typed params for free.
 */
export type MainTabParamList = {
  Home: undefined;
  Mosques: undefined;
  Messages: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  // The bottom-tab host. `screen` lets callers target a specific tab.
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Permissions: undefined;
  Activity: undefined;
  PinnedLocations: undefined;
  // `pinId` edits an existing pin; absent (or `{}`) drops a new one.
  PinEditor: { pinId?: string } | undefined;
  SavedMessages: undefined;
  DailyReminder: undefined;
  PrayerSettings: undefined;
  Qibla: undefined;
  ThemeSettings: undefined;
  LanguageSettings: undefined;
};

declare global {
  namespace ReactNavigation {
    // Registers our param list globally so useNavigation() is typed without
    // having to pass generics at every call site.
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
