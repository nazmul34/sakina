package expo.modules.ringercontrol

import android.content.Context
import android.util.Log

/**
 * The auto-silent ringer state machine (FR-1.3): silence on zone entry, restore
 * the **exact** prior state on exit, and never strand the user on silent.
 *
 * Driven by geofence enter/exit events (F-01.2), which arrive on the JS thread —
 * including in a headless background launch after an app-kill. The whole
 * capture/restore state lives in [RingerSnapshotStore] (SharedPreferences) so it
 * survives that kill and a reboot. Calls are [synchronized] so a read-modify-write
 * of the persisted set can't interleave.
 *
 * Overlapping zones are reference-counted by region ID: the prior ringer mode is
 * captured only on the **first** enter and restored only on the **last** exit, so
 * entering zone B while already in zone A never triggers a premature restore.
 */
internal object RingerSilenceController {
  private const val TAG = "RingerSilence"
  private val lock = Any()

  /**
   * Record entry into [regionId]. On the first active zone, captures the current
   * ringer mode and switches to silent. Returns the active-zone count afterward.
   */
  fun enterZone(context: Context, regionId: String): Int =
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      val zones = store.activeZones
      if (!zones.add(regionId)) {
        // Already inside this zone (duplicate enter) — nothing changes.
        return zones.size
      }

      // First zone entered: capture the prior mode, then silence. Persist the
      // snapshot before touching the ringer so a kill mid-call can still restore.
      if (zones.size == 1) {
        store.snapshot = RingerIO.getRingerMode(context)
        try {
          RingerIO.setRingerMode(context, "silent")
        } catch (e: Exception) {
          // Most likely DND access not granted. We keep the captured snapshot and
          // the zone membership; the phone simply isn't silenced this time.
          Log.w(TAG, "enterZone($regionId): could not switch to silent", e)
        }
      }

      store.activeZones = zones
      Log.i(TAG, "enterZone($regionId): ${zones.size} active zone(s)")
      zones.size
    }

  /**
   * Record exit from [regionId]. On the last active zone, restores the captured
   * prior mode — falling back to `normal` rather than leaving the user silent if
   * restoration fails. Returns the active-zone count afterward.
   */
  fun exitZone(context: Context, regionId: String): Int =
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      val zones = store.activeZones
      if (!zones.remove(regionId)) {
        // Unknown zone (e.g. exit without a matching enter) — ignore.
        return zones.size
      }
      store.activeZones = zones

      if (zones.isEmpty()) {
        restore(context, store)
      }
      Log.i(TAG, "exitZone($regionId): ${zones.size} active zone(s)")
      zones.size
    }

  /** Number of zones currently entered. */
  fun activeZoneCount(context: Context): Int =
    synchronized(lock) { RingerSnapshotStore(context).activeZones.size }

  /**
   * Restore the captured ringer mode and clear the snapshot. The safety net: if
   * the exact restore fails, try `normal`; if that also fails, log and give up —
   * but never knowingly leave the phone silent.
   */
  private fun restore(context: Context, store: RingerSnapshotStore) {
    val captured = store.snapshot ?: "normal"
    try {
      RingerIO.setRingerMode(context, captured)
    } catch (e: Exception) {
      Log.w(TAG, "restore: could not restore '$captured', falling back to normal", e)
      try {
        RingerIO.setRingerMode(context, "normal")
      } catch (e2: Exception) {
        Log.e(TAG, "restore: fallback to normal failed", e2)
      }
    } finally {
      store.snapshot = null
    }
  }
}
