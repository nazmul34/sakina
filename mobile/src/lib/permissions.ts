/**
 * Permissions model for the auto-silent checklist (FR-1.6).
 *
 * Auto-silent needs four separate grants, each from a different Android subsystem:
 *
 *   - **DND access** — to flip the ringer into/out of silent (notification policy).
 *   - **Location, all the time** — fine + background, so geofence enter/exit fires
 *     while the app is backgrounded or killed.
 *   - **Notifications** — for the foreground-service status + warnings (F-01.7).
 *   - **Battery-optimization exemption** — so Doze doesn't defer our geofence/alarm
 *     work.
 *
 * This module is the single source of truth for *reading* each status and for the
 * *fix* action that deep-links to the right place. Status reads are mostly
 * synchronous native calls; location is async (expo-location). The UI
 * ({@link ../screens/PermissionsScreen}) just renders these and re-checks on focus.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

import RingerControl from '../../modules/ringer-control';
import { translate, type TranslationKey } from './i18n';
import { ensureLocationPermission } from './location';
import { ensureNotificationPermission } from './notifications';

/** Marks that the first-launch permission prompts have already been shown. */
const FIRST_RUN_PROMPT_KEY = 'sakina.permissions_prompted';

/**
 * Ask for the two everyday permissions — notifications and (foreground) location
 * — once, right after install, so a new user grants them up front instead of
 * later finding prayer times blank or reminders silent. Runs a single time
 * (guarded by a persisted flag); afterwards each feature asks on demand when it
 * needs access (see {@link ensureLocationPermission} /
 * {@link ./notifications#ensureNotificationPermission}). The deeper auto-silent
 * grants (background location, DND, battery) stay in the checklist, which is the
 * right place for their extra rationale.
 *
 * Best-effort and non-blocking: dialogs are shown sequentially so they don't
 * stack, and any failure (or a user dismissal) is fine — nothing here gates app
 * start.
 */
export async function requestInitialPermissions(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(FIRST_RUN_PROMPT_KEY)) {
      return;
    }
    // Stamp before prompting so a mid-flow interruption doesn't re-prompt on the
    // next launch — the per-feature asks cover anything left undecided.
    await AsyncStorage.setItem(FIRST_RUN_PROMPT_KEY, '1');
  } catch {
    // Storage unavailable — still prompt once this session.
  }
  await ensureNotificationPermission();
  await ensureLocationPermission();
}

/** Stable identifier for each checklist item. */
export type PermissionKey = 'dnd' | 'location' | 'notifications' | 'battery';

export interface PermissionItem {
  readonly key: PermissionKey;
  /** Translation key for the title, resolved by the screen at render time. */
  readonly titleKey: TranslationKey;
  /** Translation key for the one-line "why we need it", shown under the title. */
  readonly descKey: TranslationKey;
  readonly granted: boolean;
}

// Translation keys per permission; the screen resolves them so the checklist
// re-renders in the active language without re-reading native status.
const COPY: Record<
  PermissionKey,
  { titleKey: TranslationKey; descKey: TranslationKey }
> = {
  dnd: { titleKey: 'permissions.dnd.title', descKey: 'permissions.dnd.desc' },
  location: {
    titleKey: 'permissions.location.title',
    descKey: 'permissions.location.desc',
  },
  notifications: {
    titleKey: 'permissions.notifications.title',
    descKey: 'permissions.notifications.desc',
  },
  battery: {
    titleKey: 'permissions.battery.title',
    descKey: 'permissions.battery.desc',
  },
};

/**
 * Whether location is granted at the level geofencing needs: background
 * ("Allow all the time") *and* fine accuracy. Background implies foreground, but
 * we still check fine accuracy explicitly — coarse isn't enough for a 150 m ring.
 */
async function isLocationReady(): Promise<boolean> {
  const [foreground, background] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),
  ]);
  return background.granted && foreground.android?.accuracy === 'fine';
}

/** Read the live status of all four permissions. */
export async function checkPermissions(): Promise<PermissionItem[]> {
  const location = await isLocationReady();
  return [
    { key: 'dnd', ...COPY.dnd, granted: RingerControl.isDndAccessGranted() },
    { key: 'location', ...COPY.location, granted: location },
    {
      key: 'notifications',
      ...COPY.notifications,
      granted: RingerControl.areNotificationsEnabled(),
    },
    {
      key: 'battery',
      ...COPY.battery,
      granted: RingerControl.isIgnoringBatteryOptimizations(),
    },
  ];
}

/**
 * Run the "Fix" action for a permission: request it in-app where Android allows,
 * otherwise deep-link to the right system screen. Resolves once the user-facing
 * step has been launched/completed; the caller re-checks status afterward.
 */
export async function fixPermission(key: PermissionKey): Promise<void> {
  switch (key) {
    case 'dnd':
      RingerControl.openDndSettings();
      return;
    case 'notifications':
      RingerControl.openNotificationSettings();
      return;
    case 'battery':
      RingerControl.openBatteryOptimizationSettings();
      return;
    case 'location':
      await fixLocation();
      return;
  }
}

/**
 * Request location in the order Android mandates — foreground first, then
 * background — with a plain-language rationale before each ask (FR-1.6). Android
 * 11+ won't grant "Allow all the time" from a dialog, so when the background
 * request comes back denied we hand off to the app's system settings.
 */
async function fixLocation(): Promise<void> {
  const foreground = await Location.getForegroundPermissionsAsync();
  if (!foreground.granted) {
    // Already permanently denied → only system settings can change it.
    if (!foreground.canAskAgain) {
      await openSettings(
        translate('permissions.locationOffTitle'),
        translate('permissions.locationOffBody'),
      );
      return;
    }
    const proceed = await confirm(
      translate('permissions.locationAccessTitle'),
      translate('permissions.locationAccessBody'),
    );
    if (!proceed) return;
    const requested = await Location.requestForegroundPermissionsAsync();
    if (!requested.granted) return;
  }

  const background = await Location.getBackgroundPermissionsAsync();
  if (background.granted) return;

  const proceed = await confirm(
    translate('permissions.allTimeTitle'),
    translate('permissions.allTimeBody'),
  );
  if (!proceed) return;

  const requested = await Location.requestBackgroundPermissionsAsync();
  if (!requested.granted) {
    // Android 11+: the only path to "Allow all the time" is system settings.
    await Linking.openSettings();
  }
}

/** Promise-based two-button confirm. Resolves false on cancel/dismiss. */
function confirm(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: translate('common.notNow'),
          style: 'cancel',
          onPress: () => resolve(false),
        },
        { text: translate('common.continue'), onPress: () => resolve(true) },
      ],
      { onDismiss: () => resolve(false) },
    );
  });
}

/** Explain, then open the app's system settings page. */
function openSettings(title: string, message: string): Promise<void> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: translate('common.notNow'),
          style: 'cancel',
          onPress: () => resolve(),
        },
        {
          text: translate('common.openSettings'),
          onPress: () => {
            void Linking.openSettings();
            resolve();
          },
        },
      ],
      { onDismiss: () => resolve() },
    );
  });
}
