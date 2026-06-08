package expo.modules.autosilent

import android.content.Context
import android.util.Log

/**
 * Single place that arms and disarms auto-silent monitoring.
 *
 * Geofencing itself (F-01.2) now lives on the JS side (expo-location +
 * expo-task-manager): registration persists across app-kill and is re-registered
 * after a reboot by expo-task-manager's own boot receiver, so the geofences do
 * not need this native path to come back. What still belongs here is the
 * foreground service + persistent notification (F-01.7), which the boot
 * [BootReceiver] must start so monitoring is visible and protected after a reboot.
 *
 * Both call sites are wired through here now, so toggling the master switch and
 * re-arming on boot already route to the right seam — today they only log. When
 * F-01.7 lands, fill these in instead of hunting for callers.
 */
internal object AutoSilentArming {
  private const val TAG = "AutoSilent"

  /** Start monitoring: run the foreground service (F-01.7). */
  fun rearm(context: Context) {
    // TODO(F-01.7): start the foreground service + persistent notification.
    Log.i(TAG, "rearm(): master toggle on — foreground service starts once F-01.7 lands")
  }

  /** Stop monitoring: stop the foreground service (F-01.7). */
  fun disarm(context: Context) {
    // TODO(F-01.7): stop the foreground service.
    Log.i(TAG, "disarm(): master toggle off — foreground service torn down")
  }
}
