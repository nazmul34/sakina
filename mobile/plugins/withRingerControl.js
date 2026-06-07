/**
 * Expo config plugin for the local `ringer-control` native module.
 *
 * The Kotlin module itself is autolinked from `modules/ringer-control`, but it
 * needs one thing the module can't add on its own: the
 * `ACCESS_NOTIFICATION_POLICY` permission must be declared in the app's
 * AndroidManifest so the OS will let the user grant Do Not Disturb access
 * (required to flip the ringer into/out of silent on Android 6.0+).
 *
 * Why a plugin and not a hand edit: `android/` is git-ignored and regenerated
 * by `expo prebuild`, so any manual manifest change would be wiped. This plugin
 * re-applies the permission on every prebuild. `VIBRATE` is already added by
 * the base Expo template, so we don't duplicate it here.
 */
const { AndroidConfig } = require('expo/config-plugins');

module.exports = function withRingerControl(config) {
  return AndroidConfig.Permissions.withPermissions(config, [
    'android.permission.ACCESS_NOTIFICATION_POLICY',
  ]);
};
