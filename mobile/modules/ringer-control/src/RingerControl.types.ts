import type { NativeModule } from 'expo';

/**
 * The phone's current ringer state, mirroring Android's three
 * `AudioManager.RINGER_MODE_*` values.
 */
export type RingerMode = 'silent' | 'vibrate' | 'normal';

/**
 * What auto-silent switches the phone into while inside a zone or prayer window
 * (FR-1.3): full `silent`, or `vibrate`. The user's choice via {@link
 * RingerControlModule.setSilenceMode}; defaults to `silent`.
 */
export type SilenceMode = 'silent' | 'vibrate';

/**
 * An auto-silent activity-log event (FR-1.8): the phone was switched to silent on
 * entering a zone, or restored to its prior mode on leaving the last one.
 */
export type ActivityEventType = 'silenced' | 'restored';

/** One entry in the device-local auto-silent activity log (FR-1.8). */
export interface ActivityLogEntry {
  /** Whether this entry records a silence or a restore. */
  readonly event: ActivityEventType;
  /**
   * Geofence region id of the zone involved. A human-readable mosque/pin name
   * replaces this once EPIC-02/03 supply one; empty string if it was unavailable.
   */
  readonly zone: string;
  /** When it happened, in epoch milliseconds. */
  readonly at: number;
}

/**
 * Native interface backing the `RingerControl` Expo module.
 *
 * The auto-silent flagship (EPIC-01) toggles the ringer when the device
 * enters/leaves a mosque geofence or a prayer window. Switching to
 * `'silent'` requires Do Not Disturb (notification policy) access on
 * Android 6.0+, which the user grants once via {@link openDndSettings}.
 */
export declare class RingerControlModule extends NativeModule {
  /**
   * Whether the app currently holds Do Not Disturb (notification policy)
   * access. Without it, {@link setRingerMode} cannot move the device into
   * (or out of) `'silent'`.
   */
  isDndAccessGranted(): boolean;

  /**
   * Opens the system "Do Not Disturb access" settings screen so the user can
   * grant access to this app. Returns immediately; check
   * {@link isDndAccessGranted} again after the user returns.
   */
  openDndSettings(): void;

  /**
   * Whether the app may post notifications. On Android 13+ this reflects the
   * `POST_NOTIFICATIONS` runtime grant; below that it reflects whether the user
   * has left the app's notifications enabled. The auto-silent foreground service
   * + warnings (F-01.7) need this. Part of the permissions checklist (F-01.6).
   */
  areNotificationsEnabled(): boolean;

  /**
   * Opens this app's system notification settings so the user can enable
   * notifications. Returns immediately; re-check {@link areNotificationsEnabled}
   * after the user returns.
   */
  openNotificationSettings(): void;

  /**
   * Whether the app is exempt from battery optimization (Doze). Without the
   * exemption the OS can defer the geofence/alarm work that drives auto-silent,
   * so the checklist (F-01.6) surfaces it.
   */
  isIgnoringBatteryOptimizations(): boolean;

  /**
   * Prompts the user to exempt this app from battery optimization — the one-tap
   * system dialog when available, otherwise the battery-optimization settings
   * list. Returns immediately; re-check {@link isIgnoringBatteryOptimizations}
   * after the user returns.
   */
  openBatteryOptimizationSettings(): void;

  /** Reads the device's current ringer mode. */
  getRingerMode(): RingerMode;

  /**
   * Sets the device ringer mode. Throws `ERR_DND_ACCESS_NOT_GRANTED` when DND
   * access is required but missing, and `ERR_INVALID_RINGER_MODE` for an
   * unknown mode.
   */
  setRingerMode(mode: RingerMode): void;

  /**
   * The mode auto-silent switches the phone into while a zone / prayer window is
   * active (FR-1.3) — `silent` or `vibrate`. Defaults to `silent`.
   */
  getSilenceMode(): SilenceMode;

  /**
   * Choose whether auto-silent fully silences the phone or drops it to vibrate
   * (FR-1.3). Persisted device-locally (survives app-kill/reboot) and applied
   * immediately to any active in-zone session, so flipping it while parked at a
   * mosque takes effect at once.
   */
  setSilenceMode(mode: SilenceMode): void;

  /**
   * Records entry into a geofenced zone (F-01.3), identified by its geofence
   * region id. Does not silence immediately: it starts a dwell grace (F-01.4) and
   * silences only if the user is still inside when it elapses, so a drive-past
   * never silences. On the first committed zone this captures the current ringer
   * mode and switches to silent; further enters just reference-count. A re-entry
   * during a zone's exit buffer cancels the pending restore (GPS-jitter bounce).
   * Returns the number of zones currently silencing (excludes those still in the
   * dwell grace). Safe to call from the background geofencing task — state is
   * persisted natively and survives app-kill/reboot.
   */
  onZoneEnter(regionId: string): number;

  /**
   * Records exit from a geofenced zone (F-01.3). Does not restore immediately: it
   * starts an exit-buffer grace (F-01.4) to absorb GPS jitter, and restores only
   * if the user hasn't re-entered when it elapses. An exit before the dwell grace
   * elapsed cancels the pending silence outright (drive-past). On the last
   * committed zone this restores the exact captured prior mode, falling back to a
   * non-silent mode rather than leaving the user stranded on silent — unless the
   * user manually changed the ringer while in the zone (F-01.5), in which case
   * their choice is honored and nothing is restored. Returns the number of zones
   * still silencing.
   */
  onZoneExit(regionId: string): number;

  /** Number of zones currently silencing the phone (debugging/observability). */
  activeZoneCount(): number;

  /**
   * Dev/QA only: hard-reset the auto-silent state machine to idle. Cancels all
   * pending dwell / exit-buffer / prayer-window timers, restores the ringer if
   * it's currently held silent, and clears persisted session state. The
   * developer panel uses this so "Enter zone" can always start a fresh dwell
   * instead of no-opping on an already-active zone. Never called on the geofence
   * path.
   */
  resetAutoSilent(): void;

  /**
   * Enable or disable prayer-aware silent (F-01.10) — the opt-in gate that, while
   * inside a zone, tightens silencing to the prayer windows pushed via
   * {@link setPrayerWindows} instead of the whole presence. Off by default; takes
   * effect immediately for any active session. When off, the gate is permissive
   * and the presence-only behaviour is unchanged.
   */
  setPrayerAware(enabled: boolean): void;

  /**
   * Push the upcoming prayer-window boundaries for the gate to schedule against.
   * `starts[i]`..`ends[i]` is one window in epoch milliseconds; the arrays are
   * parallel and expected pre-sorted and future-trimmed. Native can't compute
   * prayer times (`adhan` is JS-only), so JS precomputes a rolling list and
   * re-pushes it when arming. Pass empty arrays to clear.
   */
  setPrayerWindows(starts: number[], ends: number[]): void;

  /**
   * The auto-silent activity log (FR-1.8): silence/restore events recorded
   * device-locally by the state machine, newest first, capped at the most recent
   * 100. Synchronous — it's a single SharedPreferences read.
   */
  getActivityLog(): ActivityLogEntry[];

  /** Clears the activity log. */
  clearActivityLog(): void;

  /**
   * A stable, per-install device identifier (Android `Settings.Secure.ANDROID_ID`).
   * Used to register the device with the backend (coordinate with F-00.4).
   */
  getDeviceId(): string;
}
