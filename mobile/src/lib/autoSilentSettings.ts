/**
 * Master auto-silent toggle (FR-1.1).
 *
 * The flag's source of truth is the device-local native store (Android
 * SharedPreferences, reached through the `AutoSilent` module). Keeping it native
 * means it survives app restarts and — crucially — is readable by the boot
 * receiver after a reboot, before any JS runs, so monitoring re-arms on its own.
 * Because the source of truth is local, the feature works fully offline; syncing
 * the value up to the backend `DeviceSettings` is an opportunistic mirror added
 * later (EPIC-07), never a prerequisite.
 */

import { useCallback, useState } from 'react';

import AutoSilent from '../../modules/auto-silent';
import RingerControl, { type SilenceMode } from '../../modules/ringer-control';
import { armGeofencing, disarmGeofencing } from './geofencing';

/** Whether the auto-silent master toggle is currently on. */
export function isAutoSilentEnabled(): boolean {
  return AutoSilent.isEnabled();
}

/** Persist the master toggle and arm/disarm monitoring accordingly. */
export function setAutoSilentEnabled(value: boolean): void {
  AutoSilent.setEnabled(value);
  // Register/tear down the geofence set to match (F-01.2). Fire-and-forget: the
  // native flag above is the source of truth, and arming is best-effort (it
  // no-ops if permissions or candidates are missing), so we don't block the UI
  // toggle on it.
  void (value ? armGeofencing() : disarmGeofencing());
  // TODO(EPIC-07): opportunistically mirror this to the backend DeviceSettings
  // so it follows the user across devices. Local stays the source of truth.
}

/**
 * React state bound to the master toggle. The native getter is synchronous, so
 * we seed lazily on first render (no loading flash) and re-read after each write
 * to stay in lockstep with what the native store actually persisted.
 */
export function useAutoSilentEnabled(): readonly [
  boolean,
  (value: boolean) => void,
] {
  const [enabled, setEnabled] = useState(() => isAutoSilentEnabled());

  const toggle = useCallback((value: boolean) => {
    setAutoSilentEnabled(value);
    setEnabled(isAutoSilentEnabled());
  }, []);

  return [enabled, toggle] as const;
}

/**
 * The mode auto-silent switches the phone into while active — full `silent` or
 * `vibrate` (FR-1.3). Lives natively (in the ringer-control module) alongside
 * the state machine that consumes it, so it survives app-kill/reboot the same
 * way the master toggle does. Defaults to `silent`.
 */
export function getSilenceMode(): SilenceMode {
  return RingerControl.getSilenceMode();
}

/** Persist the silence mode; native re-applies it to any active session. */
export function setSilenceMode(mode: SilenceMode): void {
  RingerControl.setSilenceMode(mode);
}

/**
 * React state bound to the silence mode, mirroring {@link useAutoSilentEnabled}:
 * the native getter is synchronous, so we seed lazily and re-read after each
 * write to stay in lockstep with what native persisted.
 */
export function useSilenceMode(): readonly [
  SilenceMode,
  (mode: SilenceMode) => void,
] {
  const [mode, setMode] = useState<SilenceMode>(() => getSilenceMode());

  const update = useCallback((next: SilenceMode) => {
    setSilenceMode(next);
    setMode(getSilenceMode());
  }, []);

  return [mode, update] as const;
}
