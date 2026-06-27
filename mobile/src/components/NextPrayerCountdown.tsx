/**
 * Next-prayer countdown for the home screen (F-05.3 / FR-5.3).
 *
 * Shows which prayer is next and a live `H:MM:SS` countdown to it, derived from
 * the on-device computation ([[prayerTimes]]) and the user's saved method/Asr
 * config ([[prayerSettings]]) — so it works offline. When the countdown reaches
 * the prayer time it rolls over to the following prayer automatically (and to
 * tomorrow's Fajr after Isha), without remounting.
 *
 * Location is a best-effort one-shot fix; without it we can't compute times, so
 * the card invites the user to enable location rather than showing nothing.
 */

import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import type { LatLng } from '../lib/geofencing/types';
import { getHighAccuracyFix } from '../lib/location';
import { usePrayerTimesConfig } from '../lib/prayerSettings';
import {
  formatTimeOfDay,
  getNextPrayer,
  PRAYER_LABELS,
  type NextPrayer,
} from '../lib/prayerTimes';

/** Format a positive millisecond span as `H:MM:SS`. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');
  return `${hours}:${mm}:${ss}`;
}

export function NextPrayerCountdown() {
  const styles = useThemedStyles(makeStyles);
  const [config] = usePrayerTimesConfig();
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Best-effort one-shot location fix. Without it we can't compute times.
  useEffect(() => {
    let active = true;
    getHighAccuracyFix()
      .then((fix) => {
        if (active) setLocation(fix);
      })
      .catch(() => {
        if (active) setLocationError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // One-second tick driving the live countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derive the next prayer from the current instant each tick. Because the tick
  // advances `now`, the result rolls over to the following prayer the moment a
  // time passes (and to tomorrow's Fajr after Isha) with no extra bookkeeping.
  const next: NextPrayer | null = useMemo(
    () => (location ? getNextPrayer(location, new Date(now), config) : null),
    [location, now, config],
  );

  const remaining = next ? next.time.getTime() - now : 0;

  if (locationError && !next) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>Next prayer</Text>
        <Text style={styles.hint}>
          Enable location to see prayer times and your countdown.
        </Text>
      </View>
    );
  }

  if (!next) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>
        Next prayer{next.isTomorrow ? ' (tomorrow)' : ''}
      </Text>
      <View style={styles.row}>
        <Text style={styles.name}>{PRAYER_LABELS[next.name]}</Text>
        <Text style={styles.at}>{formatTimeOfDay(next.time)}</Text>
      </View>
      <Text style={styles.countdown}>in {formatCountdown(remaining)}</Text>
    </View>
  );
}

// A light green for secondary text on the always-deep-green card — reads well in
// both schemes since the card stays `brandSolid` regardless of theme.
const ON_CARD_MUTED = '#CDEBD8';

const makeStyles = (c: ThemeColors) => StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 12,
    backgroundColor: c.brandSolid,
    padding: 16,
    gap: 6,
    minHeight: 96,
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: ON_CARD_MUTED,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: c.onBrand,
  },
  at: {
    fontSize: 16,
    fontWeight: '600',
    color: ON_CARD_MUTED,
  },
  countdown: {
    fontSize: 22,
    fontWeight: '700',
    color: c.onBrand,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 13,
    color: ON_CARD_MUTED,
    lineHeight: 18,
  },
});
