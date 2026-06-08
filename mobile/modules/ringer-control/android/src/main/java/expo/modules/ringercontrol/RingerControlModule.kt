package expo.modules.ringercontrol

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `RingerControl` — Android native module (Expo Modules API).
 *
 * Exposes the ringer + Do Not Disturb primitives the auto-silent flagship
 * (EPIC-01) needs. The low-level ringer/DND access lives in [RingerIO] so it can
 * be shared with [RingerSilenceController]. All methods are synchronous
 * `Function`s because each is a cheap system-service or prefs call.
 *
 * The `onZoneEnter` / `onZoneExit` methods are the hand-off seam from the JS
 * geofencing task (F-01.2) into the capture/restore state machine (F-01.3).
 *
 * Min SDK note: the DND APIs used here
 * (`NotificationManager.isNotificationPolicyAccessGranted`,
 * `Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS`, and the policy-access
 * requirement for `setRingerMode`) are all available from API 23, which is
 * below the project's min SDK (API 24+), so no version guards are required.
 */
class RingerControlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RingerControl")

    Function("isDndAccessGranted") {
      RingerIO.isDndAccessGranted(context)
    }

    Function("openDndSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
      // From an Activity we can start it directly; from the app context we must
      // declare a new task or Android throws.
      val activity = appContext.currentActivity
      if (activity != null) {
        activity.startActivity(intent)
      } else {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    Function("getRingerMode") {
      RingerIO.getRingerMode(context)
    }

    Function("setRingerMode") { mode: String ->
      RingerIO.setRingerMode(context, mode)
    }

    // --- Auto-silent zone hand-off (F-01.3) ---------------------------------
    // Called by the geofencing task on enter/exit, passing the geofence region
    // identifier. Return the active-zone count for debugging/observability.

    Function("onZoneEnter") { regionId: String ->
      RingerSilenceController.enterZone(context, regionId)
    }

    Function("onZoneExit") { regionId: String ->
      RingerSilenceController.exitZone(context, regionId)
    }

    Function("activeZoneCount") {
      RingerSilenceController.activeZoneCount(context)
    }

    Function("getDeviceId") {
      Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()
}
