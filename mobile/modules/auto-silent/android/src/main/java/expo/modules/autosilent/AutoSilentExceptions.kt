package expo.modules.autosilent

import expo.modules.kotlin.exception.CodedException

/**
 * Thrown when the React context is unexpectedly unavailable, so we cannot reach
 * Android system services. Should not happen while the app is running.
 */
internal class MissingContextException :
  CodedException("The Android context is not available")
