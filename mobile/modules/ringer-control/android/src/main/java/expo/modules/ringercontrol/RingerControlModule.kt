package expo.modules.ringercontrol

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `RingerControl` — Android native module (Expo Modules API).
 *
 * Exposes the system-access primitives the auto-silent flagship (EPIC-01) needs:
 * the ringer + Do Not Disturb controls, plus the notification and
 * battery-optimization status/deep-links that back the permissions checklist
 * (F-01.6). The low-level ringer/DND access lives in [RingerIO] so it can be
 * shared with [RingerSilenceController]. All methods are synchronous `Function`s
 * because each is a cheap system-service call or a fire-and-forget intent.
 *
 * The `onZoneEnter` / `onZoneExit` methods are the hand-off seam from the JS
 * geofencing task (F-01.2) into the capture/restore state machine (F-01.3).
 *
 * Min SDK note: the DND APIs used here
 * (`NotificationManager.isNotificationPolicyAccessGranted`,
 * `Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS`, and the policy-access
 * requirement for `setRingerMode`) are all available from API 23, which is
 * below the project's min SDK (API 24+), so no version guards are required.
 * `ACTION_APP_NOTIFICATION_SETTINGS` (API 26+) is the one exception and is
 * guarded below.
 */
class RingerControlModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RingerControl")

    Function("isDndAccessGranted") {
      RingerIO.isDndAccessGranted(context)
    }

    Function("openDndSettings") {
      launch(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
    }

    Function("areNotificationsEnabled") {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.areNotificationsEnabled()
    }

    Function("openNotificationSettings") {
      val intent =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
            .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        } else {
          appDetailsIntent()
        }
      launch(intent)
    }

    Function("isIgnoringBatteryOptimizations") {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      pm.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatteryOptimizationSettings") {
      // Prefer the one-tap "allow?" dialog targeted at this app; if the device
      // can't resolve it, fall back to the full battery-optimization list.
      val request =
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
          .setData(Uri.parse("package:${context.packageName}"))
      if (request.resolveActivity(context.packageManager) != null) {
        launch(request)
      } else {
        launch(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
      }
    }

    Function("getRingerMode") {
      RingerIO.getRingerMode(context)
    }

    Function("setRingerMode") { mode: String ->
      RingerIO.setRingerMode(context, mode)
    }

    // --- Silence mode (FR-1.3) ----------------------------------------------
    // What auto-silent switches the phone into while inside a zone / prayer
    // window: full "silent" or "vibrate". Distinct from the master on/off
    // toggle. Changing it re-applies to any active in-zone session immediately.

    Function("getSilenceMode") {
      SilenceModeStore(context).mode
    }

    Function("setSilenceMode") { mode: String ->
      SilenceModeStore(context).mode = mode
      RingerSilenceController.onSilenceModeChanged(context)
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

    // --- Prayer-aware silent gate (F-01.10) ---------------------------------
    // JS owns prayer-time computation (adhan is JS-only), so it pushes the opt-in
    // flag and the upcoming window boundaries here; the silence state machine
    // gates on them. Both re-evaluate any active session immediately so a change
    // (toggle, or a freshly armed window list) takes effect without waiting.

    Function("setPrayerAware") { enabled: Boolean ->
      PrayerWindowStore(context).enabled = enabled
      RingerSilenceController.onGateChanged(context)
    }

    Function("setPrayerWindows") { starts: List<Double>, ends: List<Double> ->
      PrayerWindowStore(context).setWindows(
        starts.map { it.toLong() },
        ends.map { it.toLong() },
      )
      RingerSilenceController.onGateChanged(context)
    }

    // --- Activity log (F-01.8) ----------------------------------------------
    // Read/clear the device-local silence/restore trail. The events are written
    // natively by the state machine; these expose the persisted log to the UI.

    Function("getActivityLog") {
      ActivityLogStore(context).entries()
    }

    Function("clearActivityLog") {
      ActivityLogStore(context).clear()
    }

    Function("getDeviceId") {
      Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()

  /**
   * Start a settings [intent]. From an Activity we can start it directly; from
   * the app context we must add `FLAG_ACTIVITY_NEW_TASK` or Android throws.
   */
  private fun launch(intent: Intent) {
    val activity = appContext.currentActivity
    if (activity != null) {
      activity.startActivity(intent)
    } else {
      context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
  }

  /** This app's "App info" settings screen — the universal fallback. */
  private fun appDetailsIntent(): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
      .setData(Uri.parse("package:${context.packageName}"))
}
