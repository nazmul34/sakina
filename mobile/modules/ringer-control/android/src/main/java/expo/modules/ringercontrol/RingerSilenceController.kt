package expo.modules.ringercontrol

import android.content.Context
import android.util.Log

/**
 * The auto-silent ringer state machine (FR-1.3) with grace / hysteresis (FR-1.4):
 * silence on zone entry, restore the **exact** prior state on exit, never strand
 * the user on silent — and absorb GPS noise so a drive-past never silences and
 * jitter never flaps the ringer.
 *
 * Driven by geofence enter/exit events (F-01.2), which arrive on the JS thread —
 * including in a headless background launch after an app-kill. All state lives in
 * [RingerSnapshotStore] (SharedPreferences) so it survives that kill and a reboot.
 * Calls are [synchronized] so a read-modify-write of the persisted sets can't
 * interleave with an alarm firing on another thread.
 *
 * Each zone moves through a small lifecycle:
 *
 * ```
 *   enter ─▶ pendingEnter ─(dwell elapses)─▶ active ─▶ pendingExit ─(buffer)─▶ gone
 *             │  exit before dwell                       │  enter within buffer
 *             └─▶ gone (drive-past, never silenced)      └─▶ active (jitter bounce)
 * ```
 *
 * The prior ringer mode is captured only when [RingerSnapshotStore.activeZones]
 * goes empty→non-empty (first committed enter) and restored only when it goes
 * non-empty→empty (last committed exit), so overlapping zones never restore
 * prematurely. The dwell and exit-buffer waits are scheduled on [RingerHysteresis];
 * the [commitEnter] / [commitExit] halves below run when those timers fire (via
 * [RingerTimerReceiver]).
 */
internal object RingerSilenceController {
  private const val TAG = "RingerSilence"
  private val lock = Any()

  /**
   * A geofence *enter* for [regionId]. Starts the dwell grace rather than
   * silencing immediately; silencing happens in [commitEnter] once the dwell
   * elapses with the user still inside. A re-entry during the exit buffer cancels
   * the pending restore (jitter bounce). Returns the active-zone count.
   */
  fun enterZone(context: Context, regionId: String): Int =
    synchronized(lock) {
      val store = RingerSnapshotStore(context)

      // Jitter bounce: re-entered while waiting to restore — cancel the restore,
      // the zone simply stays active and silent.
      val pendingExit = store.pendingExitZones
      if (pendingExit.remove(regionId)) {
        store.pendingExitZones = pendingExit
        RingerHysteresis.cancelExitBuffer(context, regionId)
        Log.i(TAG, "enterZone($regionId): cancelled pending restore (bounce)")
        return@synchronized store.activeZones.size
      }

      // Already silencing for this zone, or already counting down its dwell —
      // (re)arm the dwell so a lost alarm (e.g. across a reboot) self-heals, but
      // don't double-count.
      if (!store.activeZones.contains(regionId)) {
        val pendingEnter = store.pendingEnterZones
        pendingEnter.add(regionId)
        store.pendingEnterZones = pendingEnter
        RingerHysteresis.scheduleDwell(context, regionId)
        Log.i(TAG, "enterZone($regionId): dwell started (${RingerHysteresis.DWELL_MS} ms)")
      }
      store.activeZones.size
    }

  /**
   * A geofence *exit* for [regionId]. If the dwell hasn't elapsed yet this is a
   * drive-past: cancel the pending silence, nothing was silenced. Otherwise start
   * the exit-buffer grace; the restore happens in [commitExit] once it elapses
   * without a re-entry. Returns the active-zone count.
   */
  fun exitZone(context: Context, regionId: String): Int =
    synchronized(lock) {
      val store = RingerSnapshotStore(context)

      // Drive-past: exited before the dwell elapsed — never silence for this zone.
      val pendingEnter = store.pendingEnterZones
      if (pendingEnter.remove(regionId)) {
        store.pendingEnterZones = pendingEnter
        RingerHysteresis.cancelDwell(context, regionId)
        Log.i(TAG, "exitZone($regionId): drive-past, cancelled dwell")
        return@synchronized store.activeZones.size
      }

      val zones = store.activeZones
      // Start (or re-arm, so a lost alarm self-heals) the exit-buffer grace, but
      // only for a zone we're actually silencing for. The zone stays counted as
      // active until the buffer elapses.
      if (zones.contains(regionId)) {
        val pendingExit = store.pendingExitZones
        pendingExit.add(regionId)
        store.pendingExitZones = pendingExit
        RingerHysteresis.scheduleExitBuffer(context, regionId)
        Log.i(TAG, "exitZone($regionId): exit buffer started (${RingerHysteresis.EXIT_BUFFER_MS} ms)")
      }
      zones.size
    }

  /**
   * The dwell elapsed for [regionId] (fired by [RingerTimerReceiver]). Promote it
   * to active; on the first active zone, capture the prior mode and silence.
   */
  fun commitEnter(context: Context, regionId: String) {
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      val pendingEnter = store.pendingEnterZones
      // Cancelled (drive-past) before the dwell fired — nothing to do.
      if (!pendingEnter.remove(regionId)) return
      store.pendingEnterZones = pendingEnter

      val zones = store.activeZones
      if (!zones.add(regionId)) return

      // First active zone: capture the prior mode, then silence. Persist the
      // snapshot before touching the ringer so a kill mid-call can still restore.
      if (zones.size == 1) {
        store.snapshot = RingerIO.getRingerMode(context)
        try {
          RingerIO.setRingerMode(context, "silent")
        } catch (e: Exception) {
          // Most likely DND access not granted. We keep the captured snapshot and
          // the zone membership; the phone simply isn't silenced this time.
          Log.w(TAG, "commitEnter($regionId): could not switch to silent", e)
        }
      }

      store.activeZones = zones
      Log.i(TAG, "commitEnter($regionId): silenced; ${zones.size} active zone(s)")
    }
  }

  /**
   * The exit buffer elapsed for [regionId] (fired by [RingerTimerReceiver]) with
   * no re-entry. Drop the zone; on the last active zone, restore the prior mode.
   */
  fun commitExit(context: Context, regionId: String) {
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      val pendingExit = store.pendingExitZones
      // Cancelled by a jitter re-entry before the buffer fired — nothing to do.
      if (!pendingExit.remove(regionId)) return
      store.pendingExitZones = pendingExit

      val zones = store.activeZones
      if (!zones.remove(regionId)) return
      store.activeZones = zones

      if (zones.isEmpty()) {
        restore(context, store)
      }
      Log.i(TAG, "commitExit($regionId): ${zones.size} active zone(s)")
    }
  }

  /** Number of zones currently keeping the phone silent. */
  fun activeZoneCount(context: Context): Int =
    synchronized(lock) { RingerSnapshotStore(context).activeZones.size }

  /**
   * Reconcile pending grace timers lost to a reboot ([RingerBootReceiver]).
   * AlarmManager alarms don't survive a reboot, so any zone caught mid-dwell or
   * mid-exit-buffer would otherwise dangle forever. We resolve each to its safe
   * terminal state:
   *
   *   - **pendingEnter** (was waiting to silence): drop it. We can't know if the
   *     user is still inside, and failing open — not silencing — is the safe bet.
   *   - **pendingExit** (was waiting to restore): complete the exit now, restoring
   *     if it was the last active zone, so the phone is never stranded on silent.
   */
  fun reconcileAfterBoot(context: Context) {
    synchronized(lock) {
      val store = RingerSnapshotStore(context)

      val pendingEnter = store.pendingEnterZones
      if (pendingEnter.isNotEmpty()) {
        Log.i(TAG, "reconcileAfterBoot: dropping ${pendingEnter.size} pending dwell(s)")
        store.pendingEnterZones = HashSet()
      }

      val pendingExit = store.pendingExitZones
      if (pendingExit.isNotEmpty()) {
        Log.i(TAG, "reconcileAfterBoot: completing ${pendingExit.size} pending exit(s)")
        val zones = store.activeZones
        zones.removeAll(pendingExit)
        store.activeZones = zones
        store.pendingExitZones = HashSet()
        if (zones.isEmpty()) {
          restore(context, store)
        }
      }
    }
  }

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
