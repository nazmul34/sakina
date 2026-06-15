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
 *   - [lastSetMode]: the ringer mode we last left the device in programmatically,
 *     during the current in-zone session (FR-1.5). It's the reference for spotting
 *     a *user-initiated* change: if the live mode later differs from this, the user
 *     moved the ringer themselves. `null` when we're not managing the ringer.
 *   - [overridden]: set once a user-initiated change is detected this session
 *     (FR-1.5). While set, we stop touching the ringer — no re-silence, no restore
 *     on exit — and it clears when the session ends.
 *   - [sessionZoneId]: the zone that started the current session, kept so the
 *     activity log (FR-1.8) can name the place on the restore event. Clears with
 *     the session.
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

  /** The mode we last set the ringer to this session, or `null` (FR-1.5). */
  var lastSetMode: String?
    get() = prefs.getString(KEY_LAST_SET_MODE, null)
    set(value) {
      prefs.edit().apply {
        if (value == null) remove(KEY_LAST_SET_MODE) else putString(KEY_LAST_SET_MODE, value)
      }.apply()
    }

  /** Whether the user has manually overridden the ringer this session (FR-1.5). */
  var overridden: Boolean
    get() = prefs.getBoolean(KEY_OVERRIDDEN, false)
    set(value) {
      prefs.edit().putBoolean(KEY_OVERRIDDEN, value).apply()
    }

  /**
   * The geofence region id of the zone that *started* the current session — the
   * first committed entry. Recorded so the activity log's restore event (FR-1.8)
   * can name the place even though the restore fires on the last exit, possibly
   * for a different zone. `null` when no session is active.
   */
  var sessionZoneId: String?
    get() = prefs.getString(KEY_SESSION_ZONE, null)
    set(value) {
      prefs.edit().apply {
        if (value == null) remove(KEY_SESSION_ZONE) else putString(KEY_SESSION_ZONE, value)
      }.apply()
    }

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
    const val KEY_LAST_SET_MODE = "last_set_mode"
    const val KEY_OVERRIDDEN = "overridden"
    const val KEY_SESSION_ZONE = "session_zone"
  }
}
