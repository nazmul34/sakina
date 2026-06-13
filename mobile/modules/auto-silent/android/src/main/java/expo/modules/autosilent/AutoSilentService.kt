package expo.modules.autosilent

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

/**
 * Foreground service + persistent notification that keep the auto-silent
 * geofence monitor alive (FR-1.7).
 *
 * **Why it exists.** The OS-scheduled geofences (F-01.2) and the headless
 * transition task run inside our process, but aggressive OEM power managers
 * (Xiaomi/MIUI, Oppo/ColorOS, realme, …) freeze or kill backgrounded apps
 * eagerly — which would stop the phone ever silencing. A foreground service is
 * the one signal Android gives the OEM that the user has an ongoing,
 * user-visible task, so the process keeps its priority and the geofences keep
 * firing. Android's mandatory ongoing notification is the price for that, and
 * doubles as honest disclosure that monitoring is active.
 *
 * **Lifecycle.** Started by [AutoSilentArming.rearm] when the master toggle goes
 * on, and again after a reboot by [BootReceiver]; stopped by
 * [AutoSilentArming.disarm] when it goes off. The notification therefore shows
 * *only while armed*. We return [START_STICKY] so a low-memory kill is restarted
 * by the OS; on that restart `intent` is null, so we re-read the persisted
 * master flag and stop ourselves if the user disarmed in the meantime.
 *
 * **Why `specialUse` and not `location`.** This service reads no location itself
 * — the OS delivers geofence transitions straight to the headless task — it only
 * keeps the process warm, so it holds no continuous resource. It is also started
 * from the background (after boot, and on a sticky restart), and the while-in-use
 * types (`location`/`camera`/`microphone`) can't be started from the background
 * on Android 14+, which would break the post-reboot restart that FR-1.7 requires.
 * `specialUse` fits both facts. See `withAutoSilent.js` for the manifest side.
 */
class AutoSilentService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // A null intent means the OS restarted us after a kill ([START_STICKY]). If
    // the user disarmed in the meantime, don't resurrect the notification — the
    // disarm path called stopService, but a restart can still race it — just stop.
    if (intent == null && !AutoSilentStore(this).enabled) {
      stopSelf()
      return START_NOT_STICKY
    }

    createChannel()
    val notification = buildNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      // The typed overload is only safe once the manifest's `specialUse` type is
      // understood by the platform (API 34+); below that we start untyped.
      startForeground(
        NOTIFICATION_ID,
        notification,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    Log.i(TAG, "foreground service started — auto-silent armed")
    return START_STICKY
  }

  /**
   * The status channel: [NotificationManager.IMPORTANCE_LOW] so the ongoing
   * notification is silent and never a heads-up — a quiet, ever-present status
   * line, not an alert. Idempotent; creating an existing channel is a no-op but
   * we skip the call anyway.
   */
  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel =
      NotificationChannel(CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shows while Sakina is watching for nearby mosques."
        setShowBadge(false)
      }
    manager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Auto-silent is on")
      .setContentText("Sakina is watching for nearby mosques to silence your phone.")
      .setSmallIcon(R.drawable.ic_auto_silent_notification)
      .setContentIntent(launchPendingIntent())
      .setOngoing(true)
      .setShowWhen(false)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  /** Tapping the notification reopens the app's main activity. */
  private fun launchPendingIntent(): PendingIntent? {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: return null
    return PendingIntent.getActivity(
      this,
      0,
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    private const val TAG = "AutoSilent"
    private const val CHANNEL_ID = "sakina.auto_silent.status"
    private const val CHANNEL_NAME = "Auto-silent status"
    private const val NOTIFICATION_ID = 1742

    /**
     * Start the service. Idempotent: a second start just re-delivers the
     * notification. Wrapped because the boot / sticky-restart paths start it from
     * the background — never let that throw take down the receiver or the process.
     */
    fun start(context: Context) {
      try {
        ContextCompat.startForegroundService(
          context,
          Intent(context, AutoSilentService::class.java),
        )
      } catch (e: Exception) {
        Log.w(TAG, "could not start foreground service", e)
      }
    }

    /** Stop the service, removing the persistent notification. */
    fun stop(context: Context) {
      context.stopService(Intent(context, AutoSilentService::class.java))
    }
  }
}
