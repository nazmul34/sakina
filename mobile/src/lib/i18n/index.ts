/**
 * App localization entry point (English / Bangla).
 *
 * Two ways to translate a key:
 *
 *  - {@link useT} — a hook for React components. It subscribes to the locale
 *    store, so the component re-renders the instant the user switches language.
 *  - {@link translate} — a plain function for non-React call sites (notification
 *    bodies, `Alert.alert`, module helpers). It reads the current locale snapshot.
 *
 * Missing keys fall back to English, then to the raw key, so a not-yet-translated
 * string is always *something* readable rather than blank. `{placeholder}` tokens
 * are filled from the `params` argument.
 */

import { useSyncExternalStore } from 'react';

import {
  getLocaleSnapshot,
  subscribeLocale,
  type AppLocale,
} from './locale';
import { translations, type TranslationKey } from './translations';

export type { TranslationKey } from './translations';

type Params = Record<string, string | number>;

function interpolate(template: string, params?: Params): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Translate a key in the given (or current) locale. Non-reactive — for use
 * outside React render (notifications, alerts, module code). Components should
 * prefer {@link useT} so they update on a language change.
 */
export function translate(
  key: TranslationKey,
  params?: Params,
  locale?: AppLocale,
): string {
  const active = locale ?? getLocaleSnapshot();
  const value = translations[active][key] ?? translations.en[key] ?? key;
  return interpolate(value, params);
}

/**
 * Hook returning a `t(key, params?)` bound to the current locale. Re-renders the
 * component whenever the language preference changes.
 */
export function useT(): (key: TranslationKey, params?: Params) => string {
  const locale = useSyncExternalStore(subscribeLocale, getLocaleSnapshot);
  return (key, params) => translate(key, params, locale);
}

export {
  DEFAULT_LOCALE,
  LOCALE_OPTIONS,
  hydrateLocale,
  useLocale,
  useLocalePreference,
  type AppLocale,
} from './locale';
