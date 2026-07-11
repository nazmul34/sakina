/**
 * App language preference: English / Bangla, persisted device-locally.
 *
 * Mirrors the theme store ({@link ../theme}) exactly — a tiny module-level
 * pub-sub over AsyncStorage — so the whole app (navigation chrome, screens,
 * components) re-renders the instant the language changes, and the choice
 * survives restarts and works offline.
 *
 * Unlike the theme, the locale is intentionally **device-local only** (no
 * backend `DeviceSettings` mirror): language is a per-device reading preference
 * and syncing it would mean a backend schema change for little benefit. If we
 * later want it to follow the user across devices, add a `locale` column to
 * DeviceSettings and adopt the same `adoptThemePreference` pattern.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

/** The persisted language preference. */
export type AppLocale = 'en' | 'bn';

/** Default before the user chooses — English (see the "Default" product decision). */
export const DEFAULT_LOCALE: AppLocale = 'en';

/** Selectable languages in display order. `native` is the label in that language itself. */
export const LOCALE_OPTIONS: readonly {
  readonly key: AppLocale;
  readonly label: string;
  readonly native: string;
}[] = [
  { key: 'en', label: 'English', native: 'English' },
  { key: 'bn', label: 'Bangla', native: 'বাংলা' },
];

const LOCALE_KEY = 'sakina.locale';

/** Type guard for a valid {@link AppLocale} (e.g. from storage). */
export function isValidLocale(value: unknown): value is AppLocale {
  return value === 'en' || value === 'bn';
}

// In-memory mirror + listeners so the UI updates synchronously on change. Seeded
// with the default until hydrateLocale() reads storage on launch.
let current: AppLocale = DEFAULT_LOCALE;
const listeners = new Set<() => void>();

function emit(next: AppLocale): void {
  current = next;
  for (const listener of listeners) {
    listener();
  }
}

/** Subscribe to preference changes; returns an unsubscribe fn (for useSyncExternalStore). */
export function subscribeLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current in-memory preference (synchronous snapshot for useSyncExternalStore). */
export function getLocaleSnapshot(): AppLocale {
  return current;
}

async function writeLocale(locale: AppLocale): Promise<void> {
  try {
    await AsyncStorage.setItem(LOCALE_KEY, locale);
  } catch {
    // best-effort
  }
}

/** Read the persisted preference, falling back to {@link DEFAULT_LOCALE}. */
export async function getStoredLocale(): Promise<AppLocale> {
  try {
    const raw = await AsyncStorage.getItem(LOCALE_KEY);
    if (isValidLocale(raw)) {
      return raw;
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_LOCALE;
}

/** Load the stored preference into memory and notify subscribers. Call once on launch. */
export async function hydrateLocale(): Promise<void> {
  emit(await getStoredLocale());
}

/** Set a user-chosen language: update the UI immediately and persist it. */
export async function setLocalePreference(locale: AppLocale): Promise<void> {
  emit(locale);
  await writeLocale(locale);
}

/**
 * React state bound to the persisted language preference. Reads the live value
 * via the module pub-sub and writes through on update. Hydration happens once on
 * launch via {@link hydrateLocale}.
 */
export function useLocalePreference(): readonly [
  AppLocale,
  (locale: AppLocale) => void,
] {
  const preference = useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
  const setPreference = useCallback((locale: AppLocale) => {
    void setLocalePreference(locale);
  }, []);
  return [preference, setPreference] as const;
}

/** The current active locale as reactive state (read-only). */
export function useLocale(): AppLocale {
  return useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
}
