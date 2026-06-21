/**
 * Shared local-notification plumbing for the on-device schedulers (daily
 * reminder F-04.6, prayer reminders F-05.4).
 *
 * `expo-notifications` exposes a single global handler and one flat list of
 * scheduled notifications with no built-in per-feature grouping. The daily
 * reminder started with the simplest possible approach — "cancel everything,
 * then reschedule" — which is fine while it's the only scheduler but silently
 * wipes a second feature's notifications the moment one exists. So each
 * scheduler tags its notifications with a {@link NotificationSource} and cancels
 * only its own via {@link cancelScheduledBySource}. The EPIC-09 Notifications
 * Hub will own this centrally; until then this keeps the schedulers coexisting.
 */

import * as Notifications from 'expo-notifications';

/** Which feature scheduled a notification, stored in `content.data.source`. */
export type NotificationSource = 'daily-reminder' | 'prayer';

/**
 * The `content.data` shape every scheduler attaches, so cancels can be scoped.
 * The index signature satisfies expo's `Record<string, unknown>` data type.
 */
export interface NotificationSourceData {
  readonly source: NotificationSource;
  readonly [key: string]: unknown;
}

// Show a banner if a notification happens to fire while the app is foregrounded.
// Sound is governed by the per-notification content / Android channel, not here.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Ensure notification permission, requesting it if it hasn't been decided yet.
 * Returns whether it is granted so callers can surface a denial.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Cancel only the scheduled notifications a given feature created. */
export async function cancelScheduledBySource(
  source: NotificationSource,
): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ids = scheduled
    .filter(
      (n) =>
        (n.content.data as Partial<NotificationSourceData> | undefined)
          ?.source === source,
    )
    .map((n) => n.identifier);
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
  );
}
