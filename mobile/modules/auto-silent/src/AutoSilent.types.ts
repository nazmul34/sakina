import type { NativeModule } from 'expo';

/**
 * Native interface backing the `AutoSilent` Expo module — the master on/off
 * switch for the auto-silent flagship (EPIC-01, FR-1.1).
 *
 * The enabled flag is the device-local source of truth and lives in Android
 * SharedPreferences (not JS storage) so the boot receiver can read it after a
 * reboot, before any JS runs, to decide whether to re-arm monitoring. JS reads
 * and writes it through this module and may mirror it to the backend
 * `DeviceSettings` opportunistically (EPIC-07) — keeping the feature fully
 * functional offline.
 */
export declare class AutoSilentModule extends NativeModule {
  /** Whether the auto-silent master toggle is currently on. */
  isEnabled(): boolean;

  /**
   * Turns the master toggle on or off and persists it. Enabling re-arms
   * monitoring; disabling de-registers geofences and stops the foreground
   * service (wired here, fully active once F-01.2 / F-01.7 land).
   */
  setEnabled(value: boolean): void;
}
