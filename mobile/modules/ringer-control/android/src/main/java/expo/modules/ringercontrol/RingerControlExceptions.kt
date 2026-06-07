package expo.modules.ringercontrol

import expo.modules.kotlin.exception.CodedException

/**
 * Thrown when the React context is unexpectedly unavailable, so we cannot
 * reach Android system services. Should not happen while the app is running.
 */
internal class MissingContextException :
  CodedException("The Android context is not available")

/**
 * Thrown by `setRingerMode` when Do Not Disturb access has not been granted.
 * Android requires notification-policy access to move the ringer into/out of
 * silent on API 23+. The caller should send the user to [openDndSettings].
 */
internal class DndAccessNotGrantedException :
  CodedException(
    "Do Not Disturb access is required to change the ringer mode. " +
      "Call openDndSettings() and have the user grant access first.",
  )

/** Thrown when `setRingerMode` receives a value that is not a known [RingerMode]. */
internal class InvalidRingerModeException(mode: String) :
  CodedException("Invalid ringer mode: '$mode'. Expected 'silent', 'vibrate' or 'normal'.")
