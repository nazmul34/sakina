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
 *
 * **Manual override (FR-1.5).** The user wins: if they move the ringer themselves
 * while in a zone, we honor it until they leave. We tell our own change apart from
 * theirs by recording the mode we leave the device in ([RingerSnapshotStore.lastSetMode])
 * and, at each geofence event, comparing it to the live mode — a mismatch is the
 * user ([refreshOverride]). Once flagged, the session is hands-off: no re-silence,
 * and on exit we keep the user's mode instead of restoring. The flag clears when the
 * session ends, so normal capture/restore resumes on the next entry. (We compare at
 * event boundaries rather than via a live `RINGER_MODE_CHANGED` receiver because the
 * background process is usually dead and a manifest receiver can't get that implicit
 * broadcast on API 26+ — see geofencing `NOTES.md` Q7.)
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
      refreshOverride(context, store)

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
      refreshOverride(context, store)

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
      refreshOverride(context, store)
      val pendingEnter = store.pendingEnterZones
      // Cancelled (drive-past) before the dwell fired — nothing to do.
      if (!pendingEnter.remove(regionId)) return
      store.pendingEnterZones = pendingEnter

      val zones = store.activeZones
      if (!zones.add(regionId)) return

      // First active zone: a fresh hands-on session. Capture the prior mode, then
      // silence. Persist the snapshot before touching the ringer so a kill mid-call
      // can still restore. Record the mode we leave the device in (read back, so a
      // failed silence is reflected too) as the baseline for spotting a later
      // user-initiated change (FR-1.5). Subsequent overlapping zones never re-touch
      // the ringer, so an override mid-session is never fought.
      if (zones.size == 1) {
        store.overridden = false
        store.snapshot = RingerIO.getRingerMode(context)
        try {
          RingerIO.setRingerMode(context, "silent")
        } catch (e: Exception) {
          // Most likely DND access not granted. We keep the captured snapshot and
          // the zone membership; the phone simply isn't silenced this time.
          Log.w(TAG, "commitEnter($regionId): could not switch to silent", e)
        }
        store.lastSetMode = RingerIO.getRingerMode(context)
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
      refreshOverride(context, store)
      val pendingExit = store.pendingExitZones
      // Cancelled by a jitter re-entry before the buffer fired — nothing to do.
      if (!pendingExit.remove(regionId)) return
      store.pendingExitZones = pendingExit

      val zones = store.activeZones
      if (!zones.remove(regionId)) return
      store.activeZones = zones

      if (zones.isEmpty()) {
        endSession(context, store)
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
          endSession(context, store)
        }
      }
    }
  }

  /**
   * Detect a *user-initiated* ringer change for the current session (FR-1.5).
   *
   * We compare the live ringer mode against [RingerSnapshotStore.lastSetMode] — the
   * mode we last left the device in. A mismatch means the user moved the ringer
   * themselves (our own changes update `lastSetMode`, so they never look like an
   * override). Once flagged we stop touching the ringer for the rest of the
   * session. No-op when we're not managing the ringer (`lastSetMode == null`) or the
   * override is already recorded. Cheap (one system-service read), so it runs on
   * every geofence event — the reliable detection point given the background
   * process is usually dead between events.
   */
  private fun refreshOverride(context: Context, store: RingerSnapshotStore) {
    if (store.overridden) return
    val expected = store.lastSetMode ?: return
    val current = RingerIO.getRingerMode(context)
    if (current != expected) {
      store.overridden = true
      Log.i(TAG, "manual override detected: expected '$expected', live '$current'")
    }
  }

  /**
   * End the in-zone session on the last committed exit. Restore the captured prior
   * mode — unless the user took manual control (FR-1.5), in which case we leave the
   * ringer exactly as they set it. Either way clear all session state so the next
   * entry starts a fresh capture/silence/restore.
   */
  private fun endSession(context: Context, store: RingerSnapshotStore) {
    if (store.overridden) {
      Log.i(TAG, "endSession: honoring manual override — leaving ringer as the user set it")
      store.snapshot = null
    } else {
      restore(context, store)
    }
    store.lastSetMode = null
    store.overridden = false
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
