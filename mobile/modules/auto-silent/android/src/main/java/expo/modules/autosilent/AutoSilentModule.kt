package expo.modules.autosilent

import android.content.Context
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * `AutoSilent` — master on/off switch for the auto-silent flagship
 * (EPIC-01, FR-1.1).
 *
 * The enabled flag is the device-local source of truth, persisted in
 * SharedPreferences via [AutoSilentStore]. It lives natively (not in JS
 * storage) so [BootReceiver] can read it after a reboot, before any JS runs, to
 * decide whether to re-arm monitoring. JS reads and writes it through this
 * module and may mirror it to the backend `DeviceSettings` later (EPIC-07).
 *
 * Both methods are synchronous `Function`s: each is a cheap prefs read/write,
 * and [AutoSilentArming] dispatches the heavier monitoring work itself.
 */
class AutoSilentModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AutoSilent")

    Function("isEnabled") {
      AutoSilentStore(context).enabled
    }

    Function("setEnabled") { value: Boolean ->
      AutoSilentStore(context).enabled = value
      if (value) AutoSilentArming.rearm(context) else AutoSilentArming.disarm(context)
    }
  }

  private val context: Context
    get() = appContext.reactContext ?: throw MissingContextException()
}
