/**
 * Shared colour palette for the app, now theme-aware (F-07.3).
 *
 * There are two palettes — {@link lightColors} and {@link darkColors} — keyed by
 * the same semantic tokens, so a component reads `c.text` / `c.surface` and gets
 * the right value for the active scheme. Resolve the live palette in a component
 * with {@link useColors} (or build a memoised StyleSheet with
 * {@link useThemedStyles}); both follow the user's Light/Dark/System preference
 * via {@link ./theme#useResolvedScheme}.
 *
 * The brand accent is the same green the message/prayer screens use. `brandSolid`
 * is the filled-button/card green that always carries white text, so it stays a
 * deep green in both schemes; `brand` is the on-surface accent (icons, links,
 * checkmarks) and lightens in dark mode so it stays legible on dark surfaces.
 */

import { useMemo } from 'react';

import { useResolvedScheme } from './theme';

/** The semantic colour tokens every screen styles against. */
export interface ThemeColors {
  /** Primary text. */
  text: string;
  /** Secondary text (subtitles, metadata). */
  textMuted: string;
  /** Tertiary text / inactive tints (e.g. inactive tab icons, chevrons). */
  muted: string;
  /** Screen background behind cards. */
  background: string;
  /** Card / row surface on the background. */
  surface: string;
  /** Slightly inset surface (inputs, nested rows). */
  surfaceAlt: string;
  /** Hairline border on a surface. */
  border: string;
  /** Stronger border (outlined controls). */
  borderStrong: string;
  /** On-surface brand accent — icons, links, checkmarks. Lighter in dark. */
  brand: string;
  /** Filled brand green that always carries white text (buttons, cards). */
  brandSolid: string;
  /** Darker brand, for pressed/emphasis on the solid green. */
  brandDark: string;
  /** Soft brand tint for chip backgrounds and pressed states. */
  brandTint: string;
  /** Text/icon colour on top of {@link brandSolid}. */
  onBrand: string;
  /** Pale blue used for secondary action chips/cards. */
  accentBlue: string;
  /** Text/icon colour on top of {@link accentBlue}; also the info accent. */
  info: string;
  /** Danger/destructive accent. */
  danger: string;
  /** Tint behind danger content. */
  dangerTint: string;
  /** Warning accent. */
  warning: string;
  /** Tint behind warning content. */
  warningTint: string;
  /** Success accent. */
  success: string;
  /** Tint behind success content. */
  successTint: string;
}

/** Light-mode palette (the app's original colours). */
export const lightColors: ThemeColors = {
  text: '#11181C',
  textMuted: '#5B636B',
  muted: '#8A8F98',
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceAlt: '#F2F4F6',
  border: '#E3E6EA',
  borderStrong: '#CBD2D8',
  brand: '#1A6B3C',
  brandSolid: '#1A6B3C',
  brandDark: '#125230',
  brandTint: '#E7F2EA',
  onBrand: '#FFFFFF',
  accentBlue: '#E6F4FE',
  info: '#0B6FB8',
  danger: '#B3261E',
  dangerTint: '#FBE9E7',
  warning: '#8A6D00',
  warningTint: '#FFF8E1',
  success: '#1B7F3B',
  successTint: '#E7F6EC',
};

/** Dark-mode palette — same tokens, tuned for legibility on a dark background. */
export const darkColors: ThemeColors = {
  text: '#E7EAED',
  textMuted: '#9BA2A9',
  muted: '#737A82',
  background: '#0F1417',
  surface: '#1A1F24',
  surfaceAlt: '#22282E',
  border: '#2C333A',
  borderStrong: '#3C444C',
  brand: '#56C98E',
  brandSolid: '#1F7A45',
  brandDark: '#155C32',
  brandTint: '#1C3A2A',
  onBrand: '#FFFFFF',
  accentBlue: '#13344C',
  info: '#7CC4F0',
  danger: '#F2B8B5',
  dangerTint: '#3B2220',
  warning: '#E6C46A',
  warningTint: '#332E15',
  success: '#56C98E',
  successTint: '#16352A',
};

/**
 * The live palette for the active scheme. Re-renders the consumer when the
 * Light/Dark/System preference (or the OS appearance, under System) changes.
 */
export function useColors(): ThemeColors {
  return useResolvedScheme() === 'dark' ? darkColors : lightColors;
}

/**
 * Build a memoised, theme-aware StyleSheet. Pass a factory that takes the live
 * palette and returns a `StyleSheet.create(...)` object; it recomputes only when
 * the scheme changes. Pairs with module-level `const makeStyles = (c) => ...`.
 */
export function useThemedStyles<T>(factory: (c: ThemeColors) => T): T {
  const c = useColors();
  return useMemo(() => factory(c), [c, factory]);
}

/**
 * Static light palette, kept for any non-component code path that needs a colour
 * outside React. UI should prefer {@link useColors} so it follows the theme.
 */
export const colors = lightColors;
