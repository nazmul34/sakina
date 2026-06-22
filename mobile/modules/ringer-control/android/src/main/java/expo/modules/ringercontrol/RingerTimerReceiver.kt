package expo.modules.ringercontrol

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Delivers a fired dwell or exit-buffer timer (FR-1.4) into the state machine.
 *
 * [RingerHysteresis] schedules these on [android.app.AlarmManager], which starts
 * the app — even from a killed process — to deliver the broadcast here. The
 * action distinguishes the dwell ([RingerHysteresis.ACTION_COMMIT_ENTER]) from the
 * exit buffer ([RingerHysteresis.ACTION_COMMIT_EXIT]); the region id rides along as
 * an extra. The work is a fast SharedPreferences + ringer update, so it runs
 * inline on the main thread.
 *
 * Statically registered (not exported) by the `withRingerControl` config plugin so
 * the OS can instantiate it for a delivery while the process is dead.
 */
class RingerTimerReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    // The prayer-window boundary is session-global and carries no zone id.
    if (intent.action == RingerHysteresis.ACTION_COMMIT_WINDOW) {
      RingerSilenceController.commitWindowBoundary(context)
      return
    }
    val regionId = intent.getStringExtra(RingerHysteresis.EXTRA_REGION_ID) ?: return
    when (intent.action) {
      RingerHysteresis.ACTION_COMMIT_ENTER -> RingerSilenceController.commitEnter(context, regionId)
      RingerHysteresis.ACTION_COMMIT_EXIT -> RingerSilenceController.commitExit(context, regionId)
    }
  }
}
