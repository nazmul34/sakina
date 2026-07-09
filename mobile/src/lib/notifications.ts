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

import { runExclusive } from './permissionQueue';

/** Which feature scheduled a notification, stored in `content.data.source`. */
export type NotificationSource = 'daily-reminder' | 'prayer';

/**
 * The `content.data` shape every scheduler attaches, so cancels can be scoped.
 * The index signature satisfies expo's `Record<string, unknown>` data type.
 */
export interface NotificationSourceData {
  readonly source: NotificationSource;
  /**
   * Whether this notification should make a sound when it fires in the
   * foreground. Needed because the handler below runs for every notification and
   * would otherwise blanket-silence them: on Android `shouldPlaySound: false`
   * overrides the channel sound (SDK 56 docs), so a reminder firing while the app
   * is open stays silent even though its channel has a sound. Each scheduler sets
   * this from its own setting (e.g. the prayer sound toggle).
   */
  readonly playSound?: boolean;
  readonly [key: string]: unknown;
}

// Present notifications that fire while the app is foregrounded. `shouldPlaySound`
// is decided per-notification from its `playSound` flag rather than hard-coded:
// on Android a blanket `false` here overrides the channel's sound, which silenced
// reminders whenever they landed in the foreground. Backgrounded notifications
// don't reach this handler — the Android channel governs their sound.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as
      | Partial<NotificationSourceData>
      | undefined;
    return {
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: data?.playSound === true,
      shouldSetBadge: false,
    };
  },
});

// Dedupe concurrent requests (the first-launch prompt and a reminder toggle) into
// a single system dialog.
let permissionRequest: Promise<boolean> | null = null;

/**
 * Ensure notification permission, requesting it if it hasn't been decided yet.
 * Returns whether it is granted so callers can surface a denial. Concurrent calls
 * share one request.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  if (!permissionRequest) {
    permissionRequest = runExclusive(() =>
      Notifications.requestPermissionsAsync(),
    )
      .then((res) => res.granted)
      .finally(() => {
        permissionRequest = null;
      });
  }
  return permissionRequest;
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
