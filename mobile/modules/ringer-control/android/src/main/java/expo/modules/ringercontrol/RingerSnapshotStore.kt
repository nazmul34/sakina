package expo.modules.ringercontrol

import android.content.Context

/**
 * Device-local persistence for the auto-silent ringer state machine (FR-1.3).
 *
 * Two things must survive an app-kill or reboot while the user is inside a zone,
 * so they live in SharedPreferences (pattern shared with `AutoSilentStore`):
 *
 *   - [snapshot]: the ringer mode captured on the *first* zone entry, restored on
 *     the *last* exit. `null` means "not currently silenced by us".
 *   - [activeZones]: the set of geofence region IDs currently entered. Acts as a
 *     reference count so overlapping zones don't restore prematurely (capture on
 *     first enter, restore on last exit).
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
   * The set of region IDs currently entered. Returns a fresh mutable copy each
   * read; assign back to persist. (SharedPreferences hands back a shared,
   * unmodifiable set, so we defensively copy.)
   */
  var activeZones: MutableSet<String>
    get() = HashSet(prefs.getStringSet(KEY_ACTIVE_ZONES, emptySet()) ?: emptySet())
    set(value) {
      prefs.edit().putStringSet(KEY_ACTIVE_ZONES, value).apply()
    }

  private companion object {
    const val PREFS_NAME = "sakina.ringer_silence"
    const val KEY_SNAPSHOT = "captured_snapshot"
    const val KEY_ACTIVE_ZONES = "active_zones"
  }
}
