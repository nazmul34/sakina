/**
 * Auto-silent activity log (FR-1.8).
 *
 * The log's source of truth is the device-local native store (Android
 * SharedPreferences, via the `RingerControl` module), where the silence/restore
 * events are written by the background state machine — including in a headless
 * launch after an app-kill, when no JS runtime is alive to record them. This
 * module is the read side: a thin wrapper plus a React hook the Activity screen
 * binds to.
 */

import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';

import RingerControl, {
  type ActivityLogEntry,
} from '../../modules/ringer-control';

/** Read the activity log, newest first (synchronous native call). */
export function getActivityLog(): ActivityLogEntry[] {
  return RingerControl.getActivityLog();
}

/** Clear the activity log. */
export function clearActivityLog(): void {
  RingerControl.clearActivityLog();
}

/**
 * React state bound to the activity log. The native getter is synchronous, so we
 * seed lazily on first render and re-read whenever the screen regains focus —
 * picking up events logged in the background while the screen wasn't mounted.
 */
export function useActivityLog(): {
  entries: ActivityLogEntry[];
  refresh: () => void;
  clear: () => void;
} {
  const [entries, setEntries] = useState<ActivityLogEntry[]>(() =>
    getActivityLog(),
  );

  const refresh = useCallback(() => setEntries(getActivityLog()), []);

  // Re-read on focus (initial mount + returning to the screen).
  useFocusEffect(refresh);

  const clear = useCallback(() => {
    clearActivityLog();
    refresh();
  }, [refresh]);

  return { entries, refresh, clear };
}
