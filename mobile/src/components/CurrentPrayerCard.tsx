/**
 * Current-prayer card for the home screen (F-05.3 / FR-5.3).
 *
 * Shows which prayer is **in effect right now** and a live `H:MM:SS` countdown of
 * how much of it remains — i.e. until the next prayer begins — derived from the
 * on-device computation ([[prayerTimes]]) and the user's saved method/Asr config
 * ([[prayerSettings]]), so it works offline. When the countdown reaches zero it
 * rolls over to the next prayer automatically (and handles the Isha→Fajr night
 * wrap), without remounting.
 *
 * Location is a best-effort fix via [[useHighAccuracyLocation]]; without it we
 * can't compute times, so the card invites the user to enable location and then
 * fills in on its own once they do (the hook retries on foreground).
 */

import { useMemo, useState, useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useHighAccuracyLocation } from '../hooks/useHighAccuracyLocation';
import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { usePrayerTimesConfig } from '../lib/prayerSettings';
import {
  formatTimeOfDay,
  getCurrentPrayer,
  type CurrentPrayer,
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

export function CurrentPrayerCard() {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const [config] = usePrayerTimesConfig();
  // Best-effort location fix. Without it we can't compute times; the hook retries
  // on foreground, so the card fills in once location is enabled rather than
  // needing an app restart.
  const { location, status: locationStatus } = useHighAccuracyLocation();
  const locationError =
    locationStatus === 'denied' || locationStatus === 'error';
  const [now, setNow] = useState(() => Date.now());

  // One-second tick driving the live countdown.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Derive the current prayer from the current instant each tick. Because the tick
  // advances `now`, the result rolls over to the next prayer the moment this one
  // ends (and wraps Isha→Fajr overnight) with no extra bookkeeping.
  const current: CurrentPrayer | null = useMemo(
    () => (location ? getCurrentPrayer(location, new Date(now), config) : null),
    [location, now, config],
  );

  const remaining = current ? current.end.getTime() - now : 0;

  if (locationError && !current) {
    return (
      <View style={styles.card}>
        <Text style={styles.label}>{t('currentPrayer.label')}</Text>
        <Text style={styles.hint}>{t('currentPrayer.enableLocation')}</Text>
      </View>
    );
  }

  if (!current) {
    return (
      <View style={styles.card}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{t('currentPrayer.label')}</Text>
      <View style={styles.row}>
        <Text style={styles.name}>{t(`prayer.${current.name}`)}</Text>
        <Text style={styles.at}>
          {t('currentPrayer.endsAt', { time: formatTimeOfDay(current.end) })}
        </Text>
      </View>
      <Text style={styles.countdown}>
        {t('currentPrayer.remaining', { time: formatCountdown(remaining) })}
      </Text>
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
