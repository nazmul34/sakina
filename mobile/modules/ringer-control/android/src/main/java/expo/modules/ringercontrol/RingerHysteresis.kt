package expo.modules.ringercontrol

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.SystemClock

/**
 * Grace / hysteresis timers for the auto-silent state machine (FR-1.4).
 *
 * Geofence enter/exit events are noisy: GPS jitter bounces the user in and out of
 * a zone, and a drive-past briefly trips a zone the user never actually visits.
 * Acting on the raw transition would silence the phone for someone driving by and
 * flap the ringer on every jitter. So we defer:
 *
 *   - **Dwell ([DWELL_MS]):** after an *enter*, wait before silencing. The user
 *     must still be inside when the timer fires — a drive-past exits first and
 *     never silences.
 *   - **Exit buffer ([EXIT_BUFFER_MS]):** after an *exit*, wait before restoring.
 *     A jitter re-entry within the window cancels the restore, so we don't restore
 *     then immediately re-silence.
 *
 * The timers must outlive the JS runtime: a geofence transition spins up a
 * headless JS task that finishes (and the process may be killed) long before a
 * 45 s dwell elapses, so a JS `setTimeout` would never fire. We therefore schedule
 * on [AlarmManager], which wakes the app — even from a killed process — to deliver
 * to [RingerTimerReceiver]. State lives in [RingerSnapshotStore] (SharedPreferences)
 * so a kill mid-window doesn't lose the pending zone.
 *
 * `setAndAllowWhileIdle` (not `setExact*`) is deliberate: it fires through Doze
 * without the `SCHEDULE_EXACT_ALARM` permission required on API 31+. A geofence
 * transition has just woken the device, so the short delays here land close to
 * on time; a few seconds of slop on a 45 s dwell or 20 s buffer is immaterial.
 *
 * Caveat: AlarmManager alarms do **not** survive a reboot. [RingerBootReceiver]
 * reconciles any pending zones left dangling by a reboot mid-window.
 */
internal object RingerHysteresis {
  /**
   * Dwell before silencing after entry. 45 s sits in the middle of the FR-1.4
   * 30–60 s range: long enough to reject a drive-past (crossing a 150 m-radius
   * zone's ~300 m diameter takes <30 s above ~25 km/h) without making a genuine
   * visitor wait a full minute.
   */
  const val DWELL_MS = 45_000L

  /**
   * Grace after exit before restoring. 20 s comfortably absorbs a momentary
   * GPS-jitter bounce (which resolves in seconds) while restoring the ringer only
   * trivially late for someone genuinely leaving.
   */
  const val EXIT_BUFFER_MS = 20_000L

  const val ACTION_COMMIT_ENTER = "expo.modules.ringercontrol.COMMIT_ENTER"
  const val ACTION_COMMIT_EXIT = "expo.modules.ringercontrol.COMMIT_EXIT"

  /**
   * Prayer-window boundary timer (F-01.10). Unlike the per-zone dwell/exit timers
   * this is session-global — there is one "next boundary" at a time — so it uses a
   * fixed region key.
   */
  const val ACTION_COMMIT_WINDOW = "expo.modules.ringercontrol.COMMIT_WINDOW"
  private const val WINDOW_REGION_KEY = "prayer-window"

  const val EXTRA_REGION_ID = "regionId"

  /** Schedule the dwell timer for [regionId]; fires [ACTION_COMMIT_ENTER]. */
  fun scheduleDwell(context: Context, regionId: String) =
    schedule(context, ACTION_COMMIT_ENTER, regionId, DWELL_MS)

  /** Schedule the exit-buffer timer for [regionId]; fires [ACTION_COMMIT_EXIT]. */
  fun scheduleExitBuffer(context: Context, regionId: String) =
    schedule(context, ACTION_COMMIT_EXIT, regionId, EXIT_BUFFER_MS)

  /** Cancel a pending dwell timer (e.g. a drive-past that exited before silencing). */
  fun cancelDwell(context: Context, regionId: String) =
    cancel(context, ACTION_COMMIT_ENTER, regionId)

  /** Cancel a pending exit-buffer timer (e.g. a jitter re-entry within the window). */
  fun cancelExitBuffer(context: Context, regionId: String) =
    cancel(context, ACTION_COMMIT_EXIT, regionId)

  /**
   * Schedule the next prayer-window boundary at absolute epoch time [atMs]; fires
   * [ACTION_COMMIT_WINDOW]. The boundary is a wall-clock instant, so we convert it
   * to an elapsed-realtime delay (clamped to ≥ 0 — a boundary already due fires
   * promptly). Replaces any previously scheduled boundary (same PendingIntent).
   */
  fun scheduleWindowBoundary(context: Context, atMs: Long) {
    val delayMs = (atMs - System.currentTimeMillis()).coerceAtLeast(0L)
    schedule(context, ACTION_COMMIT_WINDOW, WINDOW_REGION_KEY, delayMs)
  }

  /** Cancel a pending prayer-window boundary timer (e.g. on the last zone exit). */
  fun cancelWindowBoundary(context: Context) =
    cancel(context, ACTION_COMMIT_WINDOW, WINDOW_REGION_KEY)

  private fun schedule(context: Context, action: String, regionId: String, delayMs: Long) {
    alarmManager(context).setAndAllowWhileIdle(
      AlarmManager.ELAPSED_REALTIME_WAKEUP,
      SystemClock.elapsedRealtime() + delayMs,
      pendingIntent(context, action, regionId),
    )
  }

  private fun cancel(context: Context, action: String, regionId: String) {
    alarmManager(context).cancel(pendingIntent(context, action, regionId))
  }

  /**
   * A [PendingIntent] unique per (action, region). `PendingIntent` identity
   * ignores extras, so the region is encoded in the intent `data` URI to keep one
   * zone's alarm from clobbering or cancelling another's; the distinct `action`
   * separates the enter and exit timers.
   */
  private fun pendingIntent(context: Context, action: String, regionId: String): PendingIntent {
    val intent =
      Intent(context, RingerTimerReceiver::class.java).apply {
        this.action = action
        data = Uri.fromParts("sakina-ringer", regionId, null)
        putExtra(EXTRA_REGION_ID, regionId)
      }
    return PendingIntent.getBroadcast(
      context.applicationContext,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun alarmManager(context: Context): AlarmManager =
    context.applicationContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
}
