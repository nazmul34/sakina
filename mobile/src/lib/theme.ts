/**
 * App theme preference: Light / Dark / System, persisted and synced (F-07.3 / FR-7.1).
 *
 * The user's choice is stored device-locally in AsyncStorage so it survives
 * restarts and works offline, and mirrored up to the backend `DeviceSettings`
 * via the EPIC-07 sync ({@link ./deviceSettingsSync}) so it follows them across
 * devices — the same opportunistic-mirror pattern the prayer settings use.
 *
 * `'system'` defers to the OS appearance (resolved at render time with
 * `useColorScheme`); `'light'`/`'dark'` pin it. A tiny module-level pub-sub lets
 * both the app chrome (`App.tsx`) and the picker screen react the instant the
 * preference changes — whether the user picked it or a background sync adopted a
 * newer value from another device.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

import { setLocalUpdatedAt } from './deviceSettings';

/** The persisted theme preference. `'system'` follows the OS appearance. */
export type AppTheme = 'light' | 'dark' | 'system';

/** Default before the user chooses — follow the OS, the least surprising option. */
export const DEFAULT_THEME: AppTheme = 'system';

/** Selectable themes in display order, with labels (drives the picker UI). */
export const THEME_OPTIONS: readonly { readonly key: AppTheme; readonly label: string }[] =
  [
    { key: 'light', label: 'Light' },
    { key: 'dark', label: 'Dark' },
    { key: 'system', label: 'System' },
  ];

const THEME_KEY = 'sakina.theme';

/** Type guard for a valid {@link AppTheme} (e.g. from storage or the server). */
export function isValidTheme(value: unknown): value is AppTheme {
  return value === 'light' || value === 'dark' || value === 'system';
}

// In-memory mirror + listeners so the UI updates synchronously on change. Seeded
// with the default until hydrateTheme() reads storage on launch.
let current: AppTheme = DEFAULT_THEME;
const listeners = new Set<() => void>();

function emit(next: AppTheme): void {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe to preference changes; returns an unsubscribe fn (for useSyncExternalStore). */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current in-memory preference (synchronous snapshot for useSyncExternalStore). */
export function getThemeSnapshot(): AppTheme {
  return current;
}

async function writeTheme(theme: AppTheme): Promise<void> {
  try {
    await AsyncStorage.setItem(THEME_KEY, theme);
  } catch {
    // best-effort
  }
}

/** Read the persisted preference, falling back to {@link DEFAULT_THEME}. */
export async function getStoredTheme(): Promise<AppTheme> {
  try {
    const raw = await AsyncStorage.getItem(THEME_KEY);
    if (isValidTheme(raw)) {
      return raw;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_THEME;
}

/** Load the stored preference into memory and notify subscribers. Call once on launch. */
export async function hydrateTheme(): Promise<void> {
  emit(await getStoredTheme());
}

/**
 * Set a user-chosen preference: update the UI, persist it, and stamp the
 * device-settings sync clock with "now" so the choice wins last-write-wins
 * against older server state on the next sync.
 */
export async function setThemePreference(theme: AppTheme): Promise<void> {
  emit(theme);
  await writeTheme(theme);
  await setLocalUpdatedAt(Date.now());
}

/**
 * Adopt a preference pulled from the server during sync, stamping the local
 * clock with the server's `updatedAt` (not "now") so it isn't mistaken for a
 * fresh local edit. Invalid input is ignored. Used only by {@link ./deviceSettingsSync}.
 */
export async function adoptThemePreference(
  theme: AppTheme,
  updatedAt: number,
): Promise<void> {
  if (!isValidTheme(theme)) {
    return;
  }
  emit(theme);
  await writeTheme(theme);
  await setLocalUpdatedAt(updatedAt);
}

/**
 * React state bound to the persisted theme preference. Reads the live value via
 * the module pub-sub (so it reflects both user picks and sync-adopted changes)
 * and writes through on update. Hydration happens once on launch via
 * {@link hydrateTheme}.
 */
export function useThemePreference(): readonly [
  AppTheme,
  (theme: AppTheme) => void,
] {
  const preference = useSyncExternalStore(subscribeTheme, getThemeSnapshot);
  const setPreference = useCallback((theme: AppTheme) => {
    void setThemePreference(theme);
  }, []);
  return [preference, setPreference] as const;
}

/**
 * The effective light/dark scheme to render: the OS appearance when the
 * preference is `'system'`, otherwise the pinned choice. Recomputes when either
 * the preference or the OS appearance changes.
 */
export function useResolvedScheme(): 'light' | 'dark' {
  const preference = useSyncExternalStore(subscribeTheme, getThemeSnapshot);
  const system = useColorScheme();
  if (preference === 'system') {
    return system === 'dark' ? 'dark' : 'light';
  }
  return preference;
}
