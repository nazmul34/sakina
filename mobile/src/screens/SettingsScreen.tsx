import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RingerControlPanel } from '../components/RingerControlPanel';
import { API_BASE_URL, SHOW_DEV_TOOLS } from '../config/env';
import { useColors, useThemedStyles, type ThemeColors } from '../lib/colors';
import { getDeviceId } from '../lib/deviceId';
import { useT, type TranslationKey } from '../lib/i18n';
import type { RootStackParamList } from '../navigation/types';

type StackRoute = keyof RootStackParamList;

interface SettingsRow {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly labelKey: TranslationKey;
  readonly subtitleKey: TranslationKey;
  readonly route: StackRoute;
}

interface SettingsSection {
  readonly titleKey: TranslationKey;
  readonly rows: readonly SettingsRow[];
}

// Everything reachable from the old Home link list, regrouped into themed
// sections so it scans as settings rather than a flat pile of buttons. Labels are
// translation keys, resolved to the active language at render time.
const SECTIONS: readonly SettingsSection[] = [
  {
    titleKey: 'settings.section.prayer',
    rows: [
      {
        icon: 'time-outline',
        labelKey: 'settings.prayerTimes.label',
        subtitleKey: 'settings.prayerTimes.subtitle',
        route: 'PrayerSettings',
      },
      {
        icon: 'compass-outline',
        labelKey: 'settings.qibla.label',
        subtitleKey: 'settings.qibla.subtitle',
        route: 'Qibla',
      },
    ],
  },
  {
    titleKey: 'settings.section.locations',
    rows: [
      {
        icon: 'pin-outline',
        labelKey: 'settings.pinnedZones.label',
        subtitleKey: 'settings.pinnedZones.subtitle',
        route: 'PinnedLocations',
      },
    ],
  },
  {
    titleKey: 'settings.section.messages',
    rows: [
      {
        icon: 'heart-outline',
        labelKey: 'settings.savedMessages.label',
        subtitleKey: 'settings.savedMessages.subtitle',
        route: 'SavedMessages',
      },
      {
        icon: 'notifications-outline',
        labelKey: 'settings.dailyReminder.label',
        subtitleKey: 'settings.dailyReminder.subtitle',
        route: 'DailyReminder',
      },
    ],
  },
  {
    titleKey: 'settings.section.app',
    rows: [
      {
        icon: 'color-palette-outline',
        labelKey: 'settings.appearance.label',
        subtitleKey: 'settings.appearance.subtitle',
        route: 'ThemeSettings',
      },
      {
        icon: 'language-outline',
        labelKey: 'settings.language.label',
        subtitleKey: 'settings.language.subtitle',
        route: 'LanguageSettings',
      },
      {
        icon: 'shield-checkmark-outline',
        labelKey: 'settings.permissions.label',
        subtitleKey: 'settings.permissions.subtitle',
        route: 'Permissions',
      },
      {
        icon: 'list-outline',
        labelKey: 'settings.activity.label',
        subtitleKey: 'settings.activity.subtitle',
        route: 'Activity',
      },
    ],
  },
];

/**
 * Settings hub — the fourth tab. Replaces the long link list the old Home screen
 * carried, grouping each destination into a themed section of tappable rows. The
 * developer/QA ringer panel lives at the very bottom, out of the main flow.
 */
export function SettingsScreen() {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getDeviceId().then((id) => {
      if (active) setDeviceId(id);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {SECTIONS.map((section) => (
        <View key={section.titleKey} style={styles.section}>
          <Text style={styles.sectionTitle}>{t(section.titleKey)}</Text>
          <View style={styles.card}>
            {section.rows.map((row, index) => (
              <Row
                key={row.route}
                row={row}
                first={index === 0}
                onPress={() => navigation.navigate(row.route)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Developer/QA tools and the API/device footer are gated on
          SHOW_DEV_TOOLS: shown in debug and in a testing build
          (EXPO_PUBLIC_SHOW_DEV_TOOLS=1), always hidden in release/production so
          the ringer harness, backend URL, and raw device id never ship. */}
      {SHOW_DEV_TOOLS && (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('settings.section.developer')}</Text>
            <RingerControlPanel />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>API: {API_BASE_URL}</Text>
            <Text style={styles.footerText}>Device: {deviceId ?? '…'}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Row({
  row,
  first,
  onPress,
}: {
  row: SettingsRow;
  first: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const label = t(row.labelKey);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={row.icon} size={20} color={c.brand} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowSubtitle}>{t(row.subtitleKey)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.muted} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 10,
    marginLeft: 4,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  card: {
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.brandTint,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  rowSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
  },
  footer: {
    marginTop: 4,
    alignItems: 'center',
    gap: 2,
  },
  footerText: {
    fontSize: 11,
    color: colors.muted,
  },
});
