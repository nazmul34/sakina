package expo.modules.autosilent

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Re-arms auto-silent after a device reboot (FR-1.1).
 *
 * Statically registered for `ACTION_BOOT_COMPLETED` by the `withAutoSilent`
 * config plugin, so Android starts our process and delivers the broadcast even
 * when the user has not reopened the app since boot. We read the persisted
 * master flag straight from [AutoSilentStore] — no JS runtime required — and
 * re-arm only when it is on, matching the pre-reboot state.
 */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    if (AutoSilentStore(context).enabled) {
      AutoSilentArming.rearm(context)
    }
  }
}
