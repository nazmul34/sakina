/**
 * Per-prayer reminder notifications (FR-5.4, EPIC-05).
 *
 * Schedules a local notification at each prayer time, computed on-device from
 * the user's location and saved method/Asr config ([[prayerTimes]]) — so it
 * fires at the correct times with no backend and no network.
 *
 * **Scheduling approach.** Prayer times shift a little every day, so a single
 * repeating trigger (what the daily reminder uses) would drift. Instead we
 * schedule one-shot `DATE` notifications for every enabled prayer across a
 * rolling {@link WINDOW_DAYS}-day window and re-schedule when the prayer-times
 * screen is opened or any setting changes. The window stays small (≤ 35
 * notifications) — well under the OS pending-notification limits.
 *
 * **Adhan audio vs silent reminder.** v1 ships a standard reminder notification
 * (a HIGH-importance Android channel with the default notification tone) plus a
 * per-user sound on/off toggle, implemented as two channels because Android pins
 * sound at the channel level. Playing a full Adhan audio clip (a bundled sound
 * asset on a dedicated channel, with foreground playback) is deferred — it's a
 * larger media concern and out of scope for "schedule a reminder per prayer."
 *
 * Settings persist device-locally (AsyncStorage); a cross-device mirror is
 * EPIC-07, like the rest of the prayer settings.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import type { LatLng } from './geofencing/types';
import {
  cancelScheduledBySource,
  ensureNotificationPermission,
  type NotificationSourceData,
} from './notifications';
import {
  computeDailyPrayerTimes,
  PRAYER_LABELS,
  PRAYER_NAMES,
  type PrayerName,
  type PrayerTimesConfig,
} from './prayerTimes';

export { ensureNotificationPermission };

const SETTINGS_KEY = 'sakina.prayer_notifications';
const CHANNEL_SOUND = 'prayer-reminders';
const CHANNEL_SILENT = 'prayer-reminders-silent';

/** How many days ahead to schedule. Re-run on screen open keeps it topped up. */
const WINDOW_DAYS = 7;

/** Which prayers to be reminded for, plus whether reminders play a sound. */
export interface PrayerNotificationSettings {
  readonly enabled: boolean;
  readonly sound: boolean;
  readonly prayers: Readonly<Record<PrayerName, boolean>>;
}

/** Reminders off by default; when first enabled, all five prayers are on. */
export const DEFAULT_PRAYER_NOTIFICATIONS: PrayerNotificationSettings = {
  enabled: false,
  sound: true,
  prayers: { fajr: true, dhuhr: true, asr: true, maghrib: true, isha: true },
};

function isValid(value: unknown): value is PrayerNotificationSettings {
  const s = value as Partial<PrayerNotificationSettings> | null;
  return (
    s !== null &&
    typeof s === 'object' &&
    typeof s.enabled === 'boolean' &&
    typeof s.sound === 'boolean' &&
    s.prayers !== null &&
    typeof s.prayers === 'object' &&
    PRAYER_NAMES.every((name) => typeof s.prayers?.[name] === 'boolean')
  );
}

/** Read persisted reminder settings, falling back to the disabled default. */
export async function getPrayerNotificationSettings(): Promise<PrayerNotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PRAYER_NOTIFICATIONS;
}

async function savePrayerNotificationSettings(
  settings: PrayerNotificationSettings,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

/**
 * Android pins sound at the channel level, so we keep one audible and one silent
 * channel and schedule onto whichever the `sound` setting selects.
 */
async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
    name: 'Prayer reminders',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
    name: 'Prayer reminders (silent)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: undefined,
  });
}

/**
 * Cancel and re-schedule the rolling window of prayer reminders to match the
 * current location, config and settings. Cancelling-then-scheduling keeps it
 * idempotent: safe to call on every change and on every screen open. When
 * reminders are disabled it just clears them.
 *
 * Persists `settings` so the choice survives restarts; the caller passes the
 * latest location and prayer-time config (both needed to compute the times).
 */
export async function applyPrayerNotificationSettings(
  settings: PrayerNotificationSettings,
  location: LatLng | null,
  config: PrayerTimesConfig,
): Promise<void> {
  await savePrayerNotificationSettings(settings);
  await cancelScheduledBySource('prayer');

  if (!settings.enabled || location === null) {
    return;
  }

  await ensureAndroidChannels();
  const channelId = settings.sound ? CHANNEL_SOUND : CHANNEL_SILENT;
  const data: NotificationSourceData = {
    source: 'prayer',
    playSound: settings.sound,
  };
  const now = Date.now();

  for (let dayOffset = 0; dayOffset < WINDOW_DAYS; dayOffset += 1) {
    const day = new Date();
    day.setDate(day.getDate() + dayOffset);
    const { times } = computeDailyPrayerTimes(location, day, config);

    for (const { name, time } of times) {
      if (!settings.prayers[name] || time.getTime() <= now) {
        continue;
      }
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${PRAYER_LABELS[name]}`,
          body: `It's time for ${PRAYER_LABELS[name]}.`,
          sound: settings.sound,
          data,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: time,
          channelId,
        },
      });
    }
  }
}

/**
 * Dev/QA only: fire a real prayer reminder a couple of seconds from now, so a
 * tester can see the actual notification — same channel, copy and sound as the
 * scheduled ones — without waiting for an prayer time. Requests notification
 * permission if needed and returns whether it was granted (so the caller can
 * explain a denial). The short delay lets the tester background the app to see
 * the heads-up banner and hear the channel sound (the foreground handler shows a
 * silent banner). Tagged `source: 'prayer'` like the real ones; it fires long
 * before any reschedule could cancel it. Not part of the production flow.
 */
export async function sendTestPrayerNotification(
  name: PrayerName = 'dhuhr',
): Promise<boolean> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    return false;
  }
  const settings = await getPrayerNotificationSettings();
  await ensureAndroidChannels();
  const channelId = settings.sound ? CHANNEL_SOUND : CHANNEL_SILENT;
  const data: NotificationSourceData = {
    source: 'prayer',
    playSound: settings.sound,
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${PRAYER_LABELS[name]} (test)`,
      body: `It's time for ${PRAYER_LABELS[name]}. — developer test reminder`,
      sound: settings.sound,
      data,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 2000),
      channelId,
    },
  });
  return true;
}

/**
 * React state bound to the persisted reminder settings. Seeds from the disabled
 * default (no flash), hydrates from storage on mount. Persistence and (re)
 * scheduling are the caller's job via {@link applyPrayerNotificationSettings},
 * which needs the location and prayer-time config the screen already holds.
 */
export function usePrayerNotificationSettings(): readonly [
  PrayerNotificationSettings,
  (settings: PrayerNotificationSettings) => void,
] {
  const [settings, setSettings] = useState<PrayerNotificationSettings>(
    DEFAULT_PRAYER_NOTIFICATIONS,
  );

  useEffect(() => {
    let active = true;
    void getPrayerNotificationSettings().then((loaded) => {
      if (active) {
        setSettings(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback(
    (next: PrayerNotificationSettings) => setSettings(next),
    [],
  );

  return [settings, update] as const;
}
