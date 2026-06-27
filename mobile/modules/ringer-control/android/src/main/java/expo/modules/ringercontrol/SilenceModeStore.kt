package expo.modules.ringercontrol

import android.content.Context

/**
 * Device-local store for the *mode* auto-silent switches the phone into while
 * inside a zone or prayer window (FR-1.3): full **silent**, or **vibrate**.
 *
 * Separate concern from the master on/off toggle (the auto-silent module's
 * `AutoSilentStore`): "should we silence?" is the toggle, "silence to what?" is
 * this preference. [RingerSilenceController] reads it on every silence
 * transition, including from the headless background path after an app-kill, so
 * it must be plain SharedPreferences — the pattern shared with
 * [RingerSnapshotStore] / [PrayerWindowStore]. Defaults to "silent" so the
 * behaviour is byte-for-byte unchanged for anyone who never opens the setting.
 */
internal class SilenceModeStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /**
   * The ringer mode to apply when silencing — `"silent"` or `"vibrate"`. Reads
   * and writes are validated defensively: an unknown stored or supplied value
   * falls back to `"silent"`, so the state machine can never be handed a mode
   * [RingerIO] would reject.
   */
  var mode: String
    get() = normalize(prefs.getString(KEY_MODE, MODE_SILENT))
    set(value) {
      prefs.edit().putString(KEY_MODE, normalize(value)).apply()
    }

  private fun normalize(value: String?): String =
    if (value == MODE_VIBRATE) MODE_VIBRATE else MODE_SILENT

  private companion object {
    const val PREFS_NAME = "sakina.silence_mode"
    const val KEY_MODE = "silence_mode"
    const val MODE_SILENT = "silent"
    const val MODE_VIBRATE = "vibrate"
  }
}
