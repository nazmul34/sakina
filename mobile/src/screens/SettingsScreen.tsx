import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RingerControlPanel } from '../components/RingerControlPanel';
import { API_BASE_URL } from '../config/env';
import { colors } from '../lib/colors';
import { getDeviceId } from '../lib/deviceId';
import type { RootStackParamList } from '../navigation/types';

type StackRoute = keyof RootStackParamList;

interface SettingsRow {
  readonly icon: keyof typeof Ionicons.glyphMap;
  readonly label: string;
  readonly subtitle: string;
  readonly route: StackRoute;
}

interface SettingsSection {
  readonly title: string;
  readonly rows: readonly SettingsRow[];
}

// Everything reachable from the old Home link list, regrouped into themed
// sections so it scans as settings rather than a flat pile of buttons.
const SECTIONS: readonly SettingsSection[] = [
  {
    title: 'Prayer & worship',
    rows: [
      {
        icon: 'time-outline',
        label: 'Prayer times',
        subtitle: 'Calculation method and Asr school',
        route: 'PrayerSettings',
      },
      {
        icon: 'compass-outline',
        label: 'Qibla direction',
        subtitle: 'Find the direction of the Kaaba',
        route: 'Qibla',
      },
    ],
  },
  {
    title: 'Locations',
    rows: [
      {
        icon: 'pin-outline',
        label: 'Pinned zones',
        subtitle: 'Custom places to silence your phone',
        route: 'PinnedLocations',
      },
    ],
  },
  {
    title: 'Messages',
    rows: [
      {
        icon: 'heart-outline',
        label: 'Saved messages',
        subtitle: 'Your favourited reminders',
        route: 'SavedMessages',
      },
      {
        icon: 'notifications-outline',
        label: 'Daily reminder',
        subtitle: 'A message at a time you choose',
        route: 'DailyReminder',
      },
    ],
  },
  {
    title: 'App',
    rows: [
      {
        icon: 'color-palette-outline',
        label: 'Appearance',
        subtitle: 'Light, dark, or system theme',
        route: 'ThemeSettings',
      },
      {
        icon: 'shield-checkmark-outline',
        label: 'Permissions',
        subtitle: 'Location and Do Not Disturb access',
        route: 'Permissions',
      },
      {
        icon: 'list-outline',
        label: 'Activity log',
        subtitle: 'When and where your phone was silenced',
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
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Developer</Text>
        <RingerControlPanel />
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>API: {API_BASE_URL}</Text>
        <Text style={styles.footerText}>Device: {deviceId ?? '…'}</Text>
      </View>
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
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !first && styles.rowDivider,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={row.label}
    >
      <View style={styles.rowIcon}>
        <Ionicons name={row.icon} size={20} color={colors.brand} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
