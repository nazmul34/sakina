/**
 * Daily reminder settings screen (F-04.6 / FR-4.5).
 *
 * Lets the user enable an optional daily notification and pick the time it
 * fires. Scheduling is local/on-device (D-7) via [[dailyReminder]] —
 * `expo-notifications` — so it works with no backend. Enabling requests OS
 * notification permission; a denial is surfaced and leaves the toggle off.
 */

import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import {
  applyReminderSettings,
  DEFAULT_REMINDER,
  ensureNotificationPermission,
  formatReminderTime,
  getReminderSettings,
  scheduleDailyReminder,
  type ReminderSettings,
} from '../lib/dailyReminder';

export function DailyReminderScreen() {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT_REMINDER);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);

  // Load persisted settings on mount. If a reminder is already enabled, refresh
  // its content (the message) by rescheduling — local notifications otherwise
  // reuse the same body every day.
  useEffect(() => {
    let active = true;
    void getReminderSettings().then((loaded) => {
      if (!active) return;
      setSettings(loaded);
      setLoading(false);
      if (loaded.enabled) {
        void scheduleDailyReminder(loaded.hour, loaded.minute);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = (next: ReminderSettings) => {
    setSettings(next);
    void applyReminderSettings(next);
  };

  const handleToggle = async (value: boolean) => {
    if (!value) {
      persist({ ...settings, enabled: false });
      return;
    }
    const granted = await ensureNotificationPermission();
    if (!granted) {
      Alert.alert(
        t('dailyReminderScreen.notifOff'),
        t('dailyReminderScreen.notifOffBody'),
      );
      return;
    }
    persist({ ...settings, enabled: true });
  };

  const handleTimeChange = (
    event: DateTimePickerEvent,
    date: Date | undefined,
  ) => {
    setShowPicker(false);
    if (event.type !== 'set' || date === undefined) {
      return;
    }
    persist({
      ...settings,
      hour: date.getHours(),
      minute: date.getMinutes(),
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  const pickerValue = new Date();
  pickerValue.setHours(settings.hour, settings.minute, 0, 0);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.title}>{t('dailyReminderScreen.title')}</Text>
          <Text style={styles.subtitle}>
            {t('dailyReminderScreen.subtitle')}
          </Text>
        </View>
        <Switch
          value={settings.enabled}
          onValueChange={(value) => void handleToggle(value)}
        />
      </View>

      <Pressable
        style={[styles.timeRow, !settings.enabled && styles.timeRowDisabled]}
        onPress={() => setShowPicker(true)}
        disabled={!settings.enabled}
        accessibilityRole="button"
        accessibilityLabel={t('dailyReminderScreen.changeTime')}
      >
        <Text style={styles.timeLabel}>{t('dailyReminderScreen.time')}</Text>
        <Text style={styles.timeValue}>
          {formatReminderTime(settings.hour, settings.minute)}
        </Text>
      </Pressable>

      <Text style={styles.note}>{t('dailyReminderScreen.note')}</Text>

      {showPicker && (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          is24Hour={false}
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
  },
  timeRowDisabled: {
    opacity: 0.45,
  },
  timeLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  timeValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.brand,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
});
