package expo.modules.ringercontrol

import android.content.Context

/**
 * Device-local persistence for the auto-silent ringer state machine (FR-1.3).
 *
 * The auto-silent state must survive an app-kill or reboot while the user is
 * inside (or transitioning across) a zone, so it lives in SharedPreferences
 * (pattern shared with `AutoSilentStore`):
 *
 *   - [snapshot]: the ringer mode captured on the *first* committed zone entry,
 *     restored on the *last* committed exit. `null` means "not silenced by us".
 *   - [activeZones]: the geofence region IDs whose dwell has elapsed and that are
 *     currently keeping the phone silent. Acts as a reference count so overlapping
 *     zones don't restore prematurely (capture on first, restore on last).
 *   - [pendingEnterZones]: zones entered but still serving their dwell grace
 *     (FR-1.4) — a pending silence that a drive-past exit cancels before it fires.
 *   - [pendingExitZones]: active zones that have been exited but are still serving
 *     their exit-buffer grace (FR-1.4) — a pending restore that a jitter re-entry
 *     cancels. These remain counted in [activeZones] until the buffer elapses.
 *
 * Persisting to disk — not memory — is what lets a relaunch after an app-kill
 * mid-zone still restore the correct prior mode. `applicationContext` keeps the
 * same file regardless of which context reaches it.
 */
internal class RingerSnapshotStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** The captured prior ringer mode, or `null` when we are not silencing. */
  var snapshot: String?
    get() = prefs.getString(KEY_SNAPSHOT, null)
    set(value) {
      prefs.edit().apply {
        if (value == null) remove(KEY_SNAPSHOT) else putString(KEY_SNAPSHOT, value)
      }.apply()
    }

  /**
   * The region IDs currently keeping the phone silent. Each accessor returns a
   * fresh mutable copy; assign back to persist.
   */
  var activeZones: MutableSet<String>
    get() = readSet(KEY_ACTIVE_ZONES)
    set(value) = writeSet(KEY_ACTIVE_ZONES, value)

  /** Zones serving their dwell grace before silencing (FR-1.4). */
  var pendingEnterZones: MutableSet<String>
    get() = readSet(KEY_PENDING_ENTER)
    set(value) = writeSet(KEY_PENDING_ENTER, value)

  /** Exited zones serving their exit-buffer grace before restoring (FR-1.4). */
  var pendingExitZones: MutableSet<String>
    get() = readSet(KEY_PENDING_EXIT)
    set(value) = writeSet(KEY_PENDING_EXIT, value)

  /** SharedPreferences hands back a shared, unmodifiable set, so copy defensively. */
  private fun readSet(key: String): MutableSet<String> =
    HashSet(prefs.getStringSet(key, emptySet()) ?: emptySet())

  private fun writeSet(key: String, value: Set<String>) {
    prefs.edit().putStringSet(key, value).apply()
  }

  private companion object {
    const val PREFS_NAME = "sakina.ringer_silence"
    const val KEY_SNAPSHOT = "captured_snapshot"
    const val KEY_ACTIVE_ZONES = "active_zones"
    const val KEY_PENDING_ENTER = "pending_enter_zones"
    const val KEY_PENDING_EXIT = "pending_exit_zones"
  }
}
