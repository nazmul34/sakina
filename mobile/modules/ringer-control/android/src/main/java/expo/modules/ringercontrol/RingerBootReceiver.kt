package expo.modules.ringercontrol

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Reconciles grace timers (FR-1.4) lost to a reboot.
 *
 * The dwell and exit-buffer waits live in [android.app.AlarmManager], whose alarms
 * are cleared on reboot. A device that restarts while a zone is mid-dwell or
 * mid-exit-buffer would leave that zone dangling in SharedPreferences forever —
 * worst case stranding the phone on silent. Statically registered for
 * `ACTION_BOOT_COMPLETED` by the `withRingerControl` config plugin, this runs our
 * process after boot — no JS runtime required — and resolves each pending zone to
 * its safe terminal state via [RingerSilenceController.reconcileAfterBoot].
 *
 * This is independent of the auto-silent `BootReceiver`, which re-arms monitoring;
 * here we only clean up the ringer-control state machine's own pending timers.
 */
class RingerBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    RingerSilenceController.reconcileAfterBoot(context)
  }
}
