import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AutoSilentToggle } from '../components/AutoSilentToggle';
import { LocationHeader } from '../components/LocationHeader';
import { NextPrayerCountdown } from '../components/NextPrayerCountdown';
import { apiFetch } from '../lib/api';
import { colors } from '../lib/colors';

/**
 * Home dashboard — the app's landing tab.
 *
 * Replaces the old single-page link list: the day's essentials sit up top (next
 * prayer + the auto-silent master switch), with the rest of the app reached
 * through a tidy quick-action grid and the bottom tab bar. The header is hidden
 * for this tab (see {@link ../navigation/MainTabs}) so the greeting hero reads as
 * the screen title.
 */
export function HomeScreen() {
  const navigation = useNavigation();

  useEffect(() => {
    // Ping the backend on first paint so the server upserts a Device row on
    // first contact (F-00.4). The X-Device-Id header is attached by apiFetch;
    // failures are non-fatal (e.g. backend offline).
    apiFetch('/health').catch(() => {});
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.greeting}>Assalamu alaikum</Text>
          <LocationHeader />
          <Text style={styles.tagline}>
            Your phone, respectful around mosques and during prayer.
          </Text>
        </View>

        <NextPrayerCountdown />
        <AutoSilentToggle />

        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.grid}>
          <QuickAction
            icon="location-outline"
            label="Nearby mosques"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Mosques' })}
          />
          <QuickAction
            icon="compass-outline"
            label="Qibla direction"
            onPress={() => navigation.navigate('Qibla')}
          />
          <QuickAction
            icon="book-outline"
            label="Daily message"
            onPress={() => navigation.navigate('MainTabs', { screen: 'Messages' })}
          />
          <QuickAction
            icon="time-outline"
            label="Prayer times"
            onPress={() => navigation.navigate('PrayerSettings')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={22} color={colors.brand} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingBottom: 32,
  },
  hero: {
    marginBottom: 20,
    gap: 6,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  sectionTitle: {
    marginTop: 28,
    marginBottom: 14,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  action: {
    // Two per row: half the width minus the gap.
    width: '47.5%',
    flexGrow: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  actionPressed: {
    backgroundColor: colors.brandTint,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});
