package expo.modules.autosilent

import android.content.Context

/**
 * Single place that arms and disarms auto-silent monitoring.
 *
 * Geofencing itself (F-01.2) lives on the JS side (expo-location +
 * expo-task-manager): registration persists across app-kill and is re-registered
 * after a reboot by expo-task-manager's own boot receiver, so the geofences do
 * not need this native path to come back. What belongs here is the foreground
 * service + persistent notification ([AutoSilentService], F-01.7), which keeps
 * the process alive on aggressive OEMs and which the boot [BootReceiver] must
 * start so monitoring is visible and protected after a reboot.
 *
 * Both call sites — the master switch ([AutoSilentModule.setEnabled]) and the
 * boot re-arm — route through here, so the foreground service tracks the master
 * flag exactly: on while armed, gone while disarmed.
 */
internal object AutoSilentArming {
  /** Start monitoring: run the foreground service + persistent notification. */
  fun rearm(context: Context) {
    AutoSilentService.start(context)
  }

  /** Stop monitoring: tear down the foreground service and its notification. */
  fun disarm(context: Context) {
    AutoSilentService.stop(context)
  }
}
