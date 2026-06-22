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
   * to active; on the first active zone, open a session and silence — subject to
   * the prayer-window gate (F-01.10).
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
      store.activeZones = zones

      // First active zone: a fresh hands-on session. Capture the prior mode and
      // seed the override baseline as the captured mode (we haven't changed the
      // ringer yet). Then apply the gated decision: with prayer-aware off the gate
      // is permissive, so we silence immediately exactly as before; with it on we
      // silence only inside a prayer window and let the boundary alarm flip us
      // later. Subsequent overlapping zones never re-open the session.
      if (zones.size == 1) {
        store.overridden = false
        store.silencing = false
        store.snapshot = RingerIO.getRingerMode(context)
        store.lastSetMode = store.snapshot
        store.sessionZoneId = regionId
        applyDesiredSilence(context, store)
        scheduleNextWindowBoundary(context)
      }

      Log.i(TAG, "commitEnter($regionId): ${zones.size} active zone(s)")
    }
  }

  /**
   * A prayer-window boundary elapsed (fired by [RingerTimerReceiver]) — a window
   * just opened or closed (F-01.10). Re-apply the gated decision for the active
   * session and schedule the next boundary. Ignores stale firings after the
   * session has ended.
   */
  fun commitWindowBoundary(context: Context) {
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      if (store.activeZones.isEmpty()) {
        RingerHysteresis.cancelWindowBoundary(context)
        return
      }
      refreshOverride(context, store)
      applyDesiredSilence(context, store)
      scheduleNextWindowBoundary(context)
    }
  }

  /**
   * Re-evaluate the active session after the prayer-window gate changed underneath
   * us — JS pushed new windows or toggled the opt-in flag (F-01.10). No-op when no
   * session is active. Lets a toggle take effect immediately (e.g. turning the
   * feature on while parked at a mosque restores the ringer until the next window).
   */
  fun onGateChanged(context: Context) {
    synchronized(lock) {
      val store = RingerSnapshotStore(context)
      if (store.activeZones.isEmpty()) return
      refreshOverride(context, store)
      applyDesiredSilence(context, store)
      scheduleNextWindowBoundary(context)
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
        RingerHysteresis.cancelWindowBoundary(context)
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
          RingerHysteresis.cancelWindowBoundary(context)
          endSession(context, store)
        }
      }

      // Prayer-window boundary alarms are also lost to the reboot. For a still-active
      // prayer-aware session, re-evaluate the gate now and re-schedule the next
      // boundary so silencing tracks the windows again. Gated on `enabled` so the
      // presence-only path's boot behaviour is unchanged (it already holds silent).
      if (store.activeZones.isNotEmpty() && PrayerWindowStore(context).enabled) {
        applyDesiredSilence(context, store)
        scheduleNextWindowBoundary(context)
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
   * mode if we're still holding silent — unless the user took manual control
   * (FR-1.5), in which case [setSilenced] no-ops and we leave the ringer exactly as
   * they set it. If a prayer-window gap already restored us, there's nothing to do.
   * Either way clear all session state so the next entry starts fresh.
   */
  private fun endSession(context: Context, store: RingerSnapshotStore) {
    if (store.overridden) {
      // The user took manual control (FR-1.5): we restore nothing — the trail
      // honestly shows the silence without a close.
      Log.i(TAG, "endSession: honoring manual override — leaving ringer as the user set it")
    } else {
      // Restores (and logs) only if we are currently silencing; a no-op if a
      // prayer-window gap already returned the ringer to the captured mode.
      setSilenced(context, store, false)
    }
    store.snapshot = null
    store.sessionZoneId = null
    store.lastSetMode = null
    store.overridden = false
    store.silencing = false
  }

  /**
   * Drive the ringer to the desired silence state for the current session and
   * record it, the single place that touches the ringer. Hands off entirely once
   * the user has overridden (FR-1.5), and no-ops when already in the desired
   * state. Silencing captures nothing (the session's [RingerSnapshotStore.snapshot]
   * already holds the prior mode); un-silencing restores that snapshot but keeps it,
   * so a later prayer window in the same session can re-silence and the final exit
   * can still restore. The safety net on restore — fall back to `normal` — never
   * knowingly leaves the phone stranded on silent (FR-1.3).
   */
  private fun setSilenced(context: Context, store: RingerSnapshotStore, silent: Boolean) {
    if (store.overridden) return
    if (silent == store.silencing) return

    if (silent) {
      // Persist intent before touching the ringer so a kill mid-call still restores.
      store.silencing = true
      try {
        RingerIO.setRingerMode(context, "silent")
        // Worked — clear any standing DND warning so a future failure warns again (FR-1.9).
        AutoSilentWarnings.clear(context, WarningType.DND_ACCESS)
      } catch (e: Exception) {
        // DND access revoked: snapshot + session kept, but not silenced this time.
        // Warn (throttled) so the failure isn't silent (FR-1.9).
        Log.w(TAG, "setSilenced: could not switch to silent", e)
        AutoSilentWarnings.report(context, WarningType.DND_ACCESS)
      }
      store.lastSetMode = RingerIO.getRingerMode(context)
      ActivityLogStore(context).append(ActivityLogStore.EVENT_SILENCED, store.sessionZoneId ?: "")
    } else {
      val captured = store.snapshot ?: "normal"
      try {
        RingerIO.setRingerMode(context, captured)
      } catch (e: Exception) {
        Log.w(TAG, "setSilenced: could not restore '$captured', falling back to normal", e)
        try {
          RingerIO.setRingerMode(context, "normal")
        } catch (e2: Exception) {
          Log.e(TAG, "setSilenced: fallback to normal failed", e2)
        }
      }
      store.silencing = false
      store.lastSetMode = RingerIO.getRingerMode(context)
      ActivityLogStore(context).append(ActivityLogStore.EVENT_RESTORED, store.sessionZoneId ?: "")
    }
  }

  /**
   * Apply the gated silence decision for the active session: be silent iff a zone
   * is active **and** the prayer-window gate permits it now ([PrayerWindowStore],
   * permissive when prayer-aware is off). Delegates the actual transition + logging
   * to [setSilenced].
   */
  private fun applyDesiredSilence(context: Context, store: RingerSnapshotStore) {
    val allowed = PrayerWindowStore(context).allowedNow(System.currentTimeMillis())
    setSilenced(context, store, store.activeZones.isNotEmpty() && allowed)
  }

  /**
   * Schedule the next prayer-window boundary alarm for the active session, or
   * cancel it when none remain / prayer-aware is off (the gate returns `null`).
   */
  private fun scheduleNextWindowBoundary(context: Context) {
    val next = PrayerWindowStore(context).nextBoundaryAfter(System.currentTimeMillis())
    if (next != null) {
      RingerHysteresis.scheduleWindowBoundary(context, next)
    } else {
      RingerHysteresis.cancelWindowBoundary(context)
    }
  }
}
