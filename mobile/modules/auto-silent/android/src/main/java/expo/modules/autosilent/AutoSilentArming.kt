package expo.modules.autosilent

import android.content.Context
import android.util.Log

/**
 * Single place that arms and disarms auto-silent monitoring.
 *
 * F-01.1 delivers only the master toggle, its persistence, and the boot
 * re-arm plumbing. The parts that actually monitor location land later:
 *   - geofence registration via expo-location + expo-task-manager (F-01.2)
 *   - foreground service + persistent notification (F-01.7)
 *
 * Both call sites are wired through here now, so toggling the master switch and
 * re-arming on [BootReceiver] already route to the right seam — today they only
 * log. When F-01.2 / F-01.7 land, fill these in instead of hunting for callers.
 */
internal object AutoSilentArming {
  private const val TAG = "AutoSilent"

  /** Start monitoring: register geofences from cache and run the foreground service. */
  fun rearm(context: Context) {
    // TODO(F-01.2 / F-01.7): register geofences + start the foreground service.
    Log.i(TAG, "rearm(): master toggle on — monitoring starts once F-01.2/F-01.7 land")
  }

  /** Stop monitoring: de-register geofences and stop the foreground service. */
  fun disarm(context: Context) {
    // TODO(F-01.2 / F-01.7): de-register geofences + stop the foreground service.
    Log.i(TAG, "disarm(): master toggle off — geofences/service torn down")
  }
}
