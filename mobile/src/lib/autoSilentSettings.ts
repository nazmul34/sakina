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

/** Whether the auto-silent master toggle is currently on. */
export function isAutoSilentEnabled(): boolean {
  return AutoSilent.isEnabled();
}

/** Persist the master toggle and arm/disarm monitoring accordingly. */
export function setAutoSilentEnabled(value: boolean): void {
  AutoSilent.setEnabled(value);
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
