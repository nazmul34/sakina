/**
 * Optional daily message reminder (F-04.6 / FR-4.5).
 *
 * Delivery decision — **D-7: local on-device scheduling** (documented in
 * mobile/README.md). The PRD recommends local as the cheapest option, so we use
 * `expo-notifications` to schedule a repeating daily notification at the user's
 * chosen time. No backend, no push tokens — it works offline once scheduled. A
 * server-push path (fresh content pushed daily, richer targeting) is deferred to
 * the EPIC-09 Notifications Hub, which will own scheduling app-wide.
 *
 * Content caveat of local scheduling: a repeating local notification reuses the
 * same body each day, so we embed a message fetched when the reminder is
 * (re)scheduled and refresh it whenever the user opens the reminder screen or
 * changes the time. Truly different-every-day content needs server push
 * (EPIC-09).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { composeShareText, fetchRandomMessage } from './messagesApi';
import {
  cancelScheduledBySource,
  type NotificationSourceData,
} from './notifications';

// Notification permission helper now lives in the shared notifications module so
// the prayer-reminder scheduler can use it too; re-exported here for the screen.
export { ensureNotificationPermission } from './notifications';

const SETTINGS_KEY = 'sakina.daily_reminder';
// Bumped to `-v2` when the channel gained HIGH importance + an explicit sound:
// Android channels are immutable once created, so a new id is the only way those
// settings reach devices that already made the original, quieter channel.
const ANDROID_CHANNEL_ID = 'daily-reminder-v2';
const LEGACY_ANDROID_CHANNEL_ID = 'daily-reminder';

export interface ReminderSettings {
  readonly enabled: boolean;
  /** Local hour (0–23) the reminder fires. */
  readonly hour: number;
  /** Local minute (0–59) the reminder fires. */
  readonly minute: number;
}

export const DEFAULT_REMINDER: ReminderSettings = {
  enabled: false,
  hour: 8,
  minute: 0,
};

function isValid(value: unknown): value is ReminderSettings {
  const s = value as Partial<ReminderSettings> | null;
  return (
    s !== null &&
    typeof s === 'object' &&
    typeof s.enabled === 'boolean' &&
    typeof s.hour === 'number' &&
    typeof s.minute === 'number'
  );
}

/** Read persisted reminder settings, falling back to the disabled default. */
export async function getReminderSettings(): Promise<ReminderSettings> {
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
  return DEFAULT_REMINDER;
}

async function saveReminderSettings(settings: ReminderSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  // HIGH importance + an explicit default sound so the reminder reliably makes a
  // sound (and a heads-up) when the phone isn't silenced.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Daily reminder',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
  });
  // Remove the old, quieter channel so users don't see a stale duplicate in
  // system settings (best-effort; harmless if it was never created).
  await Notifications.deleteNotificationChannelAsync(
    LEGACY_ANDROID_CHANNEL_ID,
  ).catch(() => {});
}

/** Notification title + body, from a freshly fetched message (offline-safe). */
async function buildContent(): Promise<{
  title: string;
  body: string;
  sound: boolean;
  data: NotificationSourceData;
}> {
  // `sound: true` (iOS) + `playSound` (the foreground handler) alongside the
  // channel's sound (Android background), so the reminder is audible everywhere.
  const data: NotificationSourceData = {
    source: 'daily-reminder',
    playSound: true,
  };
  try {
    const message = await fetchRandomMessage();
    return {
      title: 'Daily reminder',
      body: composeShareText(message),
      sound: true,
      data,
    };
  } catch {
    return {
      title: 'Daily reminder',
      body: "Open Sakina for today's reminder.",
      sound: true,
      data,
    };
  }
}

/** Cancel any scheduled daily reminder (leaving other features' notifications). */
export async function cancelDailyReminder(): Promise<void> {
  await cancelScheduledBySource('daily-reminder');
}

/** (Re)schedule the repeating daily reminder at the given local time. */
export async function scheduleDailyReminder(
  hour: number,
  minute: number,
): Promise<void> {
  await ensureAndroidChannel();
  await cancelDailyReminder();
  const content = await buildContent();
  await Notifications.scheduleNotificationAsync({
    content,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });
}

/**
 * Apply a new settings state: persist it and (re)schedule or cancel the OS
 * notification to match. Assumes permission is already granted when enabling —
 * the caller (the screen) requests it so it can surface a denial to the user.
 */
export async function applyReminderSettings(
  settings: ReminderSettings,
): Promise<void> {
  if (settings.enabled) {
    await scheduleDailyReminder(settings.hour, settings.minute);
  } else {
    await cancelDailyReminder();
  }
  await saveReminderSettings(settings);
}

/** Format an hour/minute as a 12-hour clock label, e.g. "8:00 AM". */
export function formatReminderTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${minute.toString().padStart(2, '0')} ${period}`;
}
