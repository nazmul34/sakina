/**
 * Nearby-mosques results screen (FR-2.4).
 *
 * The first screen that surfaces the EPIC-02 client end to end: it binds to
 * {@link useNearbyMosques} — which acquires a high-accuracy fix (F-02.3),
 * fetches `GET /mosques` (F-02.1), re-fetches on ≥20 m movement (F-02.4), and
 * falls back to cache on timeout/failure (F-02.5) — and renders each mosque with
 * its name, distance, and a bearing arrow, plus a Navigate action that hands the
 * coordinates to the device's default maps app. A staleness banner appears when
 * the list is being served from cache after a failed refresh.
 */

import { useNavigation } from '@react-navigation/native';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useNearbyMosques } from '../hooks/useNearbyMosques';
import { bearingDegrees } from '../lib/geofencing/geo';
import { LocationPermissionError } from '../lib/location';
import type { NearbyMosque } from '../lib/mosques';

// 8-point compass, indexed by round(bearing / 45). Arrows point the way the
// mosque lies relative to the user; the label spells it out for accessibility.
const COMPASS_POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
const COMPASS_ARROWS = ['↑', '↗', '→', '↘', '↓', '↙', '←', '↖'] as const;

interface MosqueItem {
  readonly mosque: NearbyMosque;
  readonly bearing: number | null;
}

export function NearbyMosquesScreen() {
  const { mosques, status, error, fromCache, lastUpdatedAt, origin, refresh } =
    useNearbyMosques();
  const navigation = useNavigation();

  // Pair each mosque with its bearing from the fetch origin, sorted nearest
  // first (the backend already sorts; we re-sort defensively so the AC holds
  // regardless of source, incl. cache).
  const items = useMemo<MosqueItem[]>(() => {
    return [...mosques]
      .sort((a, b) => a.distanceM - b.distanceM)
      .map((mosque) => ({
        mosque,
        bearing: origin
          ? bearingDegrees(origin, {
              latitude: mosque.latitude,
              longitude: mosque.longitude,
            })
          : null,
      }));
  }, [mosques, origin]);

  // First load with nothing to show yet.
  if (status === 'loading' && mosques.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.centeredBody}>Finding mosques near you…</Text>
      </View>
    );
  }

  // Hard failure with no cache to fall back to.
  if (status === 'error' && mosques.length === 0) {
    const isPermission = error instanceof LocationPermissionError;
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>
          {isPermission ? 'Location needed' : "Couldn't load mosques"}
        </Text>
        <Text style={styles.centeredBody}>
          {isPermission
            ? 'Allow location access so Sakina can find mosques near you.'
            : 'Check your connection and try again.'}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() =>
            isPermission ? navigation.navigate('Permissions') : refresh()
          }
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>
            {isPermission ? 'Set up permissions' : 'Try again'}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.mosque.id}
      contentContainerStyle={
        items.length === 0 ? styles.emptyList : styles.list
      }
      refreshControl={
        <RefreshControl
          refreshing={status === 'loading' && mosques.length > 0}
          onRefresh={refresh}
        />
      }
      ListHeaderComponent={
        fromCache && lastUpdatedAt != null ? (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>
              Showing saved results from {formatRelative(lastUpdatedAt)} —
              couldn&apos;t refresh.
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.centered}>
          <Text style={styles.centeredTitle}>No mosques nearby</Text>
          <Text style={styles.centeredBody}>
            We couldn&apos;t find any mosques within range of your location.
          </Text>
        </View>
      }
      renderItem={({ item }) => <MosqueRow item={item} />}
    />
  );
}

function MosqueRow({ item }: { item: MosqueItem }) {
  const { mosque, bearing } = item;
  const point = bearing == null ? null : COMPASS_POINTS[compassIndex(bearing)];
  const arrow = bearing == null ? null : COMPASS_ARROWS[compassIndex(bearing)];

  return (
    <View style={styles.row}>
      {arrow != null && (
        <View style={styles.bearing}>
          <Text style={styles.arrow}>{arrow}</Text>
          <Text style={styles.compass}>{point}</Text>
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={styles.name} numberOfLines={1}>
          {mosque.name}
        </Text>
        <Text style={styles.meta}>
          {formatDistance(mosque.distanceM)}
          {point != null ? ` · ${point}` : ''}
        </Text>
      </View>
      <Pressable
        style={styles.navButton}
        onPress={() => openNavigation(mosque)}
        accessibilityRole="button"
        accessibilityLabel={`Navigate to ${mosque.name}`}
      >
        <Text style={styles.navButtonText}>Navigate</Text>
      </Pressable>
    </View>
  );
}

/** Round a bearing in degrees to the nearest of the 8 compass points. */
function compassIndex(bearing: number): number {
  return Math.round(bearing / 45) % 8;
}

/** Metres → a short, human distance: "120 m" under 1 km, else "1.4 km". */
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Open the device's default maps app at the mosque. `geo:` is provider-agnostic
 * on Android (the OS shows whatever maps app the user prefers); iOS doesn't
 * honour `geo:`, so we hand it an Apple Maps URL there.
 */
function openNavigation(mosque: NearbyMosque): void {
  const label = encodeURIComponent(mosque.name);
  const { latitude, longitude } = mosque;
  const url =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${label}&ll=${latitude},${longitude}`
      : `geo:${latitude},${longitude}?q=${latitude},${longitude}(${label})`;

  Linking.openURL(url).catch(() => {
    Alert.alert('Could not open maps', 'No maps app is available to navigate.');
  });
}

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/** "5 minutes ago" within a day; an absolute date/time beyond that. */
function formatRelative(at: number): string {
  const diffMs = at - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) {
    return relativeFormatter.format(diffMin, 'minute');
  }
  const diffHr = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHr) < 24) {
    return relativeFormatter.format(diffHr, 'hour');
  }
  return dateFormatter.format(new Date(at));
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 8,
  },
  emptyList: {
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  centeredTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  centeredBody: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  staleBanner: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFF8E1',
    marginBottom: 4,
  },
  staleText: {
    fontSize: 13,
    color: '#8A6D00',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
  },
  bearing: {
    alignItems: 'center',
    width: 34,
  },
  arrow: {
    fontSize: 20,
    lineHeight: 22,
  },
  compass: {
    fontSize: 11,
    opacity: 0.6,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    opacity: 0.6,
  },
  navButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#E6F4FE',
  },
  navButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
