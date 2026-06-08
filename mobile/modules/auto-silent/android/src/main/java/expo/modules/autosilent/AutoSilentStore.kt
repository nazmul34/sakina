package expo.modules.autosilent

import android.content.Context

/**
 * Device-local persistence for the auto-silent master toggle (FR-1.1).
 *
 * Backed by SharedPreferences rather than JS storage on purpose: the
 * [BootReceiver] needs to read the flag after a reboot, before any React
 * Native / JS runtime exists, to decide whether to re-arm monitoring. Plain
 * (unencrypted) prefs are fine here — the value is a single non-sensitive
 * boolean. `applicationContext` keeps the same file whether we are called from
 * the module (with a React context) or the receiver (with a bare context).
 */
internal class AutoSilentStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) {
      prefs.edit().putBoolean(KEY_ENABLED, value).apply()
    }

  private companion object {
    const val PREFS_NAME = "sakina.auto_silent"
    const val KEY_ENABLED = "master_enabled"
  }
}
