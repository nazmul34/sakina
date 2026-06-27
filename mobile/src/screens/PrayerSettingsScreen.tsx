/**
 * Prayer-time settings screen (F-05.2 / FR-5.2).
 *
 * Lets the user choose the calculation method and Asr juristic method used to
 * compute prayer times. The selection is persisted device-locally via
 * [[prayerSettings]] and works offline. A live preview of today's five times for
 * the current location recomputes whenever the method or Asr changes, so the
 * effect of a choice is immediate and visible (the "recompute on change"
 * acceptance criterion); the real home-screen countdown is F-05.3.
 *
 * It also hosts the per-prayer reminder controls (F-05.4): a master toggle, a
 * sound on/off toggle, and a switch per prayer. Toggling any of these — or
 * opening the screen — (re)schedules the rolling window of local notifications
 * via [[prayerNotifications]], using the location and config already on screen.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { SelectField } from '../components/SelectField';
import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { getHighAccuracyFix } from '../lib/location';
import {
  evaluatePrayerAwareSilence,
  pushPrayerWindowsToNative,
  usePrayerAwareSilentSettings,
} from '../lib/prayerAwareSilent';
import {
  applyPrayerNotificationSettings,
  ensureNotificationPermission,
  usePrayerNotificationSettings,
} from '../lib/prayerNotifications';
import {
  ASR_METHODS,
  CALCULATION_METHODS,
  usePrayerTimesConfig,
} from '../lib/prayerSettings';
import {
  computeDailyPrayerTimes,
  formatTimeOfDay,
  PRAYER_LABELS,
  PRAYER_NAMES,
  type PrayerName,
} from '../lib/prayerTimes';
import type { LatLng } from '../lib/geofencing/types';

export function PrayerSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const [config, setConfig] = usePrayerTimesConfig();
  const [notifications, setNotifications] = usePrayerNotificationSettings();
  const [prayerAware, setPrayerAware] = usePrayerAwareSilentSettings();
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

  // (Re)schedule the rolling window whenever the reminder settings, the config
  // (times shift) or the location change — and on mount, which tops the window
  // up. Idempotent (cancel-then-schedule) and a no-op until location resolves.
  useEffect(() => {
    void applyPrayerNotificationSettings(notifications, location, config);
  }, [notifications, location, config]);

  const handleToggleEnabled = async (value: boolean) => {
    if (!value) {
      setNotifications({ ...notifications, enabled: false });
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      Alert.alert(
        'Notifications off',
        'Enable notifications for Sakina in your system settings to get prayer reminders.',
      );
      return;
    }
    setNotifications({ ...notifications, enabled: true });
  };

  // The prayer window active right now, if the feature is on — shown so the user
  // can see what "prayer-aware silent" would currently do. The native scheduler
  // that acts on this in the background is the remaining F-01.10 step.
  const activeWindow = useMemo(
    () => evaluatePrayerAwareSilence(prayerAware, location, config),
    [prayerAware, location, config],
  );

  // Push the opt-in flag + freshly computed windows to the native gate whenever
  // the setting, location or config changes, so a toggle takes effect right away
  // (and re-arming is not required to see it). Best-effort.
  useEffect(() => {
    void pushPrayerWindowsToNative(prayerAware, location, config);
  }, [prayerAware, location, config]);

  const togglePrayer = (name: PrayerName) => {
    setNotifications({
      ...notifications,
      prayers: {
        ...notifications.prayers,
        [name]: !notifications.prayers[name],
      },
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Today’s times</Text>
      <View style={styles.previewCard}>
        {prayerTimes ? (
          prayerTimes.times.map(({ name, time }) => (
            <View key={name} style={styles.previewRow}>
              <Text style={styles.previewName}>{PRAYER_LABELS[name]}</Text>
              <Text style={styles.previewTime}>{formatTimeOfDay(time)}</Text>
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
      <SelectField
        value={config.method}
        options={CALCULATION_METHODS}
        onChange={(method) => setConfig({ ...config, method })}
        title="Calculation method"
        accessibilityLabel="Calculation method"
      />

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

      <Text style={styles.sectionTitle}>Reminders</Text>
      <View style={styles.group}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Prayer reminders</Text>
            <Text style={styles.switchSub}>
              A notification at each prayer time.
            </Text>
          </View>
          <Switch
            value={notifications.enabled}
            onValueChange={(value) => void handleToggleEnabled(value)}
          />
        </View>

        <View style={[styles.switchRow, styles.switchRowBordered]}>
          <Text
            style={[
              styles.switchLabel,
              !notifications.enabled && styles.disabledText,
            ]}
          >
            Play sound
          </Text>
          <Switch
            value={notifications.sound}
            disabled={!notifications.enabled}
            onValueChange={(value) =>
              setNotifications({ ...notifications, sound: value })
            }
          />
        </View>

        {PRAYER_NAMES.map((name) => (
          <View key={name} style={[styles.switchRow, styles.switchRowBordered]}>
            <Text
              style={[
                styles.switchLabel,
                !notifications.enabled && styles.disabledText,
              ]}
            >
              {PRAYER_LABELS[name]}
            </Text>
            <Switch
              value={notifications.prayers[name]}
              disabled={!notifications.enabled}
              onValueChange={() => togglePrayer(name)}
            />
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Prayer-aware silent</Text>
      <View style={styles.group}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>Tighten around prayer</Text>
            <Text style={styles.switchSub}>
              Near a mosque, silence around each prayer (from just before jamaat
              to the end of salah) rather than the whole time you’re nearby.
            </Text>
          </View>
          <Switch
            value={prayerAware.enabled}
            onValueChange={(value) =>
              setPrayerAware({ ...prayerAware, enabled: value })
            }
          />
        </View>
        {prayerAware.enabled && (
          <View style={[styles.switchRow, styles.switchRowBordered]}>
            <Text style={styles.switchLabel}>Active now</Text>
            <Text style={styles.previewTime}>
              {activeWindow
                ? `${PRAYER_LABELS[activeWindow.name]} · until ${formatTimeOfDay(
                    activeWindow.end,
                  )}`
                : 'No prayer window'}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.note}>
        Prayer times are computed on your device from your location — no account
        needed, and they work offline. Reminders are scheduled locally and play
        the default notification sound. Prayer-aware silent is optional and off
        by default.
      </Text>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginTop: 8,
  },
  previewCard: {
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
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
    color: colors.text,
  },
  previewTime: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brand,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  group: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  segmentSelected: {
    backgroundColor: colors.brandSolid,
  },
  segmentLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  segmentLabelSelected: {
    color: colors.onBrand,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  switchRowBordered: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  switchText: {
    flex: 1,
    paddingRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  switchSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  disabledText: {
    opacity: 0.4,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 8,
  },
});
