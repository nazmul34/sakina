package expo.modules.ringercontrol

import android.app.NotificationManager
import android.content.Context
import android.media.AudioManager

/**
 * Low-level ringer + Do Not Disturb access, shared by [RingerControlModule] (the
 * JS-facing API) and [RingerSilenceController] (the geofence-driven state
 * machine). Pulled out of the module so both reach the ringer through one place
 * with identical DND-access semantics.
 *
 * Every function takes a plain [Context] (not an Expo `AppContext`) so it works
 * the same whether called from the module — with a React context — or from a
 * background/headless path. System-service lookups use `applicationContext`.
 *
 * Min SDK note: the policy-access requirement for `setRingerMode` is present
 * from API 23, below the project's min SDK (24+), so no version guards needed.
 */
internal object RingerIO {
  private fun audioManager(context: Context): AudioManager =
    context.applicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private fun notificationManager(context: Context): NotificationManager =
    context.applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
      as NotificationManager

  /** Whether the app holds notification-policy (DND) access. */
  fun isDndAccessGranted(context: Context): Boolean =
    notificationManager(context).isNotificationPolicyAccessGranted

  /** Reads the device's current ringer mode as a [RingerMode] string. */
  fun getRingerMode(context: Context): String =
    ringerModeToString(audioManager(context).ringerMode)

  /**
   * Sets the device ringer mode. Moving into or out of silent requires
   * notification-policy access on API 23+; without it the system silently
   * ignores the change, so we fail loudly instead.
   *
   * @throws DndAccessNotGrantedException when DND access is missing.
   * @throws InvalidRingerModeException for an unknown mode.
   */
  fun setRingerMode(context: Context, mode: String) {
    if (!isDndAccessGranted(context)) {
      throw DndAccessNotGrantedException()
    }
    audioManager(context).ringerMode = ringerModeFromString(mode)
  }

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
