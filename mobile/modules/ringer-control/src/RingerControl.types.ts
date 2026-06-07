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
   * A stable, per-install device identifier (Android `Settings.Secure.ANDROID_ID`).
   * Used to register the device with the backend (coordinate with F-00.4).
   */
  getDeviceId(): string;
}
