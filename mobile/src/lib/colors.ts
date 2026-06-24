/**
 * Shared colour palette for the redesigned app chrome (bottom tab bar, Home
 * dashboard, Settings hub).
 *
 * The brand accent is the same green the message/prayer screens already use, so
 * the new navigation reads as one app with the existing feature screens. These
 * are the light-mode values; the per-screen feature UIs keep their own hardcoded
 * colours, and the navigation chrome (headers/background) still follows the
 * Light/Dark preference via React Navigation's theme in {@link ../../App}.
 */
export const colors = {
  /** Primary brand green — active tab, primary buttons, hero accents. */
  brand: '#1A6B3C',
  brandDark: '#125230',
  /** Soft brand tint for card backgrounds and pressed states. */
  brandTint: '#E7F2EA',
  /** The pale blue used across the app for secondary action chips. */
  accentBlue: '#E6F4FE',
  /** Neutral inactive tint (inactive tab icons/labels). */
  muted: '#8A8F98',
  /** Default text. */
  text: '#11181C',
  /** Secondary text. */
  textMuted: '#5B636B',
  /** Card surface + hairline border on a white screen. */
  surface: '#FFFFFF',
  border: '#E3E6EA',
  /** Screen background behind cards. */
  background: '#F4F6F8',
} as const;
