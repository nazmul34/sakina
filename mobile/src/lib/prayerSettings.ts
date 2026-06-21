/**
 * Persisted prayer-time calculation settings (FR-5.2, EPIC-05).
 *
 * Lets the user pick the calculation method and Asr juristic method that
 * {@link ./prayerTimes#computeDailyPrayerTimes} feeds to `adhan`. The choice is
 * the {@link PrayerTimesConfig} the computation layer already accepts, stored
 * device-locally in AsyncStorage so it survives restarts and — like the prayer
 * times themselves — works fully offline.
 *
 * Local is the source of truth. Mirroring the value up to the backend
 * DeviceSettings so it follows the user across devices is owned by EPIC-07
 * (Settings Persistence & Sync), the same pattern the master auto-silent toggle
 * follows ({@link ./autoSilentSettings}); it's an opportunistic add-on, never a
 * prerequisite for this feature.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  type AsrMethod,
  type CalculationMethodKey,
  DEFAULT_PRAYER_TIMES_CONFIG,
  type PrayerTimesConfig,
} from './prayerTimes';

const SETTINGS_KEY = 'sakina.prayer_settings';

/**
 * Selectable calculation methods in display order, with labels. The PRD §6.1
 * names MWL/Umm al-Qura/Karachi explicitly; the rest are the remaining `adhan`
 * presets, offered for completeness. MWL leads as the default.
 */
export const CALCULATION_METHODS: readonly {
  readonly key: CalculationMethodKey;
  readonly label: string;
}[] = [
  { key: 'MuslimWorldLeague', label: 'Muslim World League' },
  { key: 'UmmAlQura', label: 'Umm al-Qura (Makkah)' },
  { key: 'Karachi', label: 'Karachi' },
  { key: 'Egyptian', label: 'Egyptian General Authority' },
  { key: 'Dubai', label: 'Dubai' },
  { key: 'Qatar', label: 'Qatar' },
  { key: 'Kuwait', label: 'Kuwait' },
  { key: 'Singapore', label: 'Singapore' },
  { key: 'Turkey', label: 'Turkey (Diyanet)' },
  { key: 'Tehran', label: 'Tehran' },
  { key: 'NorthAmerica', label: 'North America (ISNA)' },
  { key: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
];

/** Asr juristic methods in display order, with labels. */
export const ASR_METHODS: readonly {
  readonly key: AsrMethod;
  readonly label: string;
}[] = [
  { key: 'standard', label: 'Standard (Shafiʿi)' },
  { key: 'hanafi', label: 'Hanafi' },
];

/** Look up the display label for a calculation method, falling back to its key. */
export function calculationMethodLabel(key: CalculationMethodKey): string {
  return CALCULATION_METHODS.find((m) => m.key === key)?.label ?? key;
}

/** Look up the display label for an Asr method. */
export function asrMethodLabel(key: AsrMethod): string {
  return ASR_METHODS.find((m) => m.key === key)?.label ?? key;
}

function isValid(value: unknown): value is PrayerTimesConfig {
  const c = value as Partial<PrayerTimesConfig> | null;
  return (
    c !== null &&
    typeof c === 'object' &&
    typeof c.method === 'string' &&
    CALCULATION_METHODS.some((m) => m.key === c.method) &&
    (c.asr === 'standard' || c.asr === 'hanafi')
  );
}

/** Read the persisted config, falling back to {@link DEFAULT_PRAYER_TIMES_CONFIG}. */
export async function getPrayerTimesConfig(): Promise<PrayerTimesConfig> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isValid(parsed)) {
        return parsed;
      }
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PRAYER_TIMES_CONFIG;
}

/** Persist the config. Best-effort: a write failure leaves the in-memory state. */
export async function savePrayerTimesConfig(
  config: PrayerTimesConfig,
): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
  } catch {
    // best-effort
  }
}

/**
 * React state bound to the persisted prayer config. Seeds from the default on
 * first render (so there's no loading flash for the selection UI), hydrates from
 * storage on mount, and writes through on every update so the selection sticks.
 */
export function usePrayerTimesConfig(): readonly [
  PrayerTimesConfig,
  (config: PrayerTimesConfig) => void,
] {
  const [config, setConfig] = useState<PrayerTimesConfig>(
    DEFAULT_PRAYER_TIMES_CONFIG,
  );

  useEffect(() => {
    let active = true;
    void getPrayerTimesConfig().then((loaded) => {
      if (active) {
        setConfig(loaded);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: PrayerTimesConfig) => {
    setConfig(next);
    void savePrayerTimesConfig(next);
  }, []);

  return [config, update] as const;
}
