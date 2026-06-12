import type { NativeModule } from 'expo';

/**
 * The phone's current ringer state, mirroring Android's three
 * `AudioManager.RINGER_MODE_*` values.
 */
export type RingerMode = 'silent' | 'vibrate' | 'normal';

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

  /** Reads the device's current ringer mode. */
  getRingerMode(): RingerMode;

  /**
   * Sets the device ringer mode. Throws `ERR_DND_ACCESS_NOT_GRANTED` when DND
   * access is required but missing, and `ERR_INVALID_RINGER_MODE` for an
   * unknown mode.
   */
  setRingerMode(mode: RingerMode): void;

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
   * A stable, per-install device identifier (Android `Settings.Secure.ANDROID_ID`).
   * Used to register the device with the backend (coordinate with F-00.4).
   */
  getDeviceId(): string;
}
