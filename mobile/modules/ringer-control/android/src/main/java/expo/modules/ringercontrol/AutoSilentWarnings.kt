package expo.modules.ringercontrol

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * A failure auto-silent can warn about (FR-1.9). Each value carries its own
 * notification id (so distinct failures don't overwrite each other) and the
 * user-facing copy. The enum `name` doubles as the stable throttle key.
 */
internal enum class WarningType(
  val notificationId: Int,
  val title: String,
  val body: String,
) {
  /** Couldn't switch to silent in a zone because Do Not Disturb access is off. */
  DND_ACCESS(
    notificationId = 2001,
    title = "Auto-silent couldn't silence your phone",
    body =
      "Do Not Disturb access is off, so Sakina couldn't silence your phone near a " +
        "mosque. Open Sakina to restore it.",
  ),
}

/**
 * Honest failure transparency for auto-silent (FR-1.9).
 *
 * Silencing runs in the background, so when it fails — most often because the
 * user revoked Do Not Disturb access — the feature would otherwise fail silently
 * and quietly lose the user's trust. This surfaces a clear, **throttled** warning
 * so they can fix it, without spamming.
 *
 * **Throttle.** At most one warning per failure type per [THROTTLE_MS] (24h). A
 * later success [clear]s the type, so once the user fixes the problem a fresh
 * failure warns again right away instead of waiting out the window. Net effect:
 * "warn once, then daily until resolved."
 *
 * **Delivery is the seam for the Notifications Hub (EPIC-09 / F-09.3).** For now
 * [notify] posts a local notification directly. When the hub lands, route the
 * delivery through it so warnings respect the user's per-channel toggle rather
 * than being a standalone notification — the detection and throttle here are
 * unaffected.
 */
internal object AutoSilentWarnings {
  private const val TAG = "AutoSilentWarn"
  private const val PREFS_NAME = "sakina.warnings"
  private const val CHANNEL_ID = "sakina.auto_silent.warnings"
  private const val CHANNEL_NAME = "Auto-silent warnings"
  private const val THROTTLE_MS = 24L * 60 * 60 * 1000

  /** Report a failure of [type]; posts a warning unless it's within the throttle. */
  fun report(context: Context, type: WarningType) {
    if (!shouldWarn(context, type)) {
      Log.i(TAG, "report(${type.name}): throttled")
      return
    }
    notify(context, type)
    prefs(context).edit().putLong(type.name, System.currentTimeMillis()).apply()
    Log.i(TAG, "report(${type.name}): warned")
  }

  /**
   * Mark [type] resolved by clearing its throttle, so the next failure warns
   * immediately. Call when the action that can fail later succeeds.
   */
  fun clear(context: Context, type: WarningType) {
    prefs(context).edit().remove(type.name).apply()
  }

  private fun shouldWarn(context: Context, type: WarningType): Boolean {
    val lastWarned = prefs(context).getLong(type.name, 0L)
    return System.currentTimeMillis() - lastWarned >= THROTTLE_MS
  }

  /**
   * Post the warning. Tapping it opens the app, where the permissions checklist
   * (F-01.6) is how the user fixes most of these. Best-effort: on Android 13+ the
   * system silently drops it if POST_NOTIFICATIONS was denied.
   */
  private fun notify(context: Context, type: WarningType) {
    createChannel(context)
    val notification =
      NotificationCompat.Builder(context, CHANNEL_ID)
        .setContentTitle(type.title)
        .setContentText(type.body)
        .setStyle(NotificationCompat.BigTextStyle().bigText(type.body))
        .setSmallIcon(R.drawable.ic_warning)
        .setContentIntent(launchPendingIntent(context))
        .setAutoCancel(true)
        .setCategory(NotificationCompat.CATEGORY_ERROR)
        .setPriority(NotificationCompat.PRIORITY_HIGH)
        .build()
    notificationManager(context).notify(type.notificationId, notification)
  }

  /** Warnings channel: IMPORTANCE_HIGH so a genuine failure can surface a heads-up. */
  private fun createChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = notificationManager(context)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Warns you when auto-silent can't silence your phone."
      }
    manager.createNotificationChannel(channel)
  }

  private fun launchPendingIntent(context: Context): PendingIntent? {
    val launch =
      context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return null
    return PendingIntent.getActivity(
      context,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  private fun notificationManager(context: Context): NotificationManager =
    context.applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
      as NotificationManager

  private fun prefs(context: Context) =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
