package expo.modules.ringercontrol

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `RingerControl` — Android native module (Expo Modules API).
 *
 * Exposes the ringer + Do Not Disturb primitives the auto-silent flagship
 * (EPIC-01) needs. All methods are synchronous `Function`s because each is a
 * cheap system-service call; none block on I/O.
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
      notificationManager.isNotificationPolicyAccessGranted
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
      ringerModeToString(audioManager.ringerMode)
    }

    Function("setRingerMode") { mode: String ->
      // Moving into or out of silent requires notification-policy access on
      // API 23+; without it the system silently ignores the change.
      if (!notificationManager.isNotificationPolicyAccessGranted) {
        throw DndAccessNotGrantedException()
      }
      audioManager.ringerMode = ringerModeFromString(mode)
    }

    Function("getDeviceId") {
      Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()

  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val notificationManager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  private fun ringerModeToString(mode: Int): String =
    when (mode) {
      AudioManager.RINGER_MODE_SILENT -> "silent"
      AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
      else -> "normal"
    }

  private fun ringerModeFromString(mode: String): Int =
    when (mode) {
      "silent" -> AudioManager.RINGER_MODE_SILENT
      "vibrate" -> AudioManager.RINGER_MODE_VIBRATE
      "normal" -> AudioManager.RINGER_MODE_NORMAL
      else -> throw InvalidRingerModeException(mode)
    }
}
