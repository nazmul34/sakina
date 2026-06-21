/**
 * Prayer-time settings screen (F-05.2 / FR-5.2).
 *
 * Lets the user choose the calculation method and Asr juristic method used to
 * compute prayer times. The selection is persisted device-locally via
 * [[prayerSettings]] and works offline. A live preview of today's five times for
 * the current location recomputes whenever the method or Asr changes, so the
 * effect of a choice is immediate and visible (the "recompute on change"
 * acceptance criterion); the real home-screen countdown is F-05.3.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { getHighAccuracyFix } from '../lib/location';
import {
  ASR_METHODS,
  CALCULATION_METHODS,
  usePrayerTimesConfig,
} from '../lib/prayerSettings';
import {
  computeDailyPrayerTimes,
  PRAYER_LABELS,
} from '../lib/prayerTimes';
import type { LatLng } from '../lib/geofencing/types';

/** Format a prayer instant as a 12-hour clock label, e.g. "5:14 AM". */
function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours < 12 ? 'AM' : 'PM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function PrayerSettingsScreen() {
  const [config, setConfig] = usePrayerTimesConfig();
  const [location, setLocation] = useState<LatLng | null>(null);
  const [locationError, setLocationError] = useState(false);

  // Best-effort one-shot fix so the preview reflects the user's actual times.
  // The selection still persists without it; we just can't preview offline-of-
  // location, so we show a hint instead of blocking the screen.
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

  // Recompute whenever the location or the config (method/Asr) changes. Pure and
  // offline — this is exactly what the home countdown (F-05.3) will consume.
  const prayerTimes = useMemo(
    () => (location ? computeDailyPrayerTimes(location, new Date(), config) : null),
    [location, config],
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Today’s times</Text>
      <View style={styles.previewCard}>
        {prayerTimes ? (
          prayerTimes.times.map(({ name, time }) => (
            <View key={name} style={styles.previewRow}>
              <Text style={styles.previewName}>{PRAYER_LABELS[name]}</Text>
              <Text style={styles.previewTime}>{formatTime(time)}</Text>
            </View>
          ))
        ) : locationError ? (
          <Text style={styles.hint}>
            Grant location access to preview your prayer times. Your method choice
            below is still saved.
          </Text>
        ) : (
          <ActivityIndicator />
        )}
      </View>

      <Text style={styles.sectionTitle}>Calculation method</Text>
      <View style={styles.group}>
        {CALCULATION_METHODS.map(({ key, label }) => {
          const selected = config.method === key;
          return (
            <Pressable
              key={key}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => setConfig({ ...config, method: key })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.optionLabel,
                  selected && styles.optionLabelSelected,
                ]}
              >
                {label}
              </Text>
              {selected && <Text style={styles.check}>✓</Text>}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Asr calculation</Text>
      <View style={styles.segmented}>
        {ASR_METHODS.map(({ key, label }) => {
          const selected = config.asr === key;
          return (
            <Pressable
              key={key}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setConfig({ ...config, asr: key })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.segmentLabel,
                  selected && styles.segmentLabelSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>
        Prayer times are computed on your device from your location — no account
        needed, and they work offline.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    opacity: 0.55,
    marginTop: 8,
  },
  previewCard: {
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
    padding: 16,
    gap: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewName: {
    fontSize: 15,
    fontWeight: '600',
  },
  previewTime: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  hint: {
    fontSize: 13,
    opacity: 0.7,
    lineHeight: 18,
  },
  group: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DDD',
  },
  optionSelected: {
    backgroundColor: '#E6F4FE',
  },
  optionLabel: {
    fontSize: 15,
  },
  optionLabelSelected: {
    fontWeight: '700',
  },
  check: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: '#1A6B3C',
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  segmentLabelSelected: {
    color: '#FFF',
    fontWeight: '700',
  },
  note: {
    fontSize: 12,
    opacity: 0.55,
    lineHeight: 18,
    marginTop: 8,
  },
});
