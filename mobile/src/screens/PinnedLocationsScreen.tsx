/**
 * Pinned silent zones list (FR-3.1).
 *
 * The home for user-defined zones: it lists what's saved on this device — proving
 * pins survive restarts — and is the entry point to drop a new one or edit an
 * existing one in {@link PinEditorScreen}. Full list management (delete-from-list,
 * soft-delete + sync) lands in F-03.2; here the list is read + "tap to edit", with
 * delete living in the editor.
 */

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { readPins, type Pin } from '../lib/pins';

export function PinnedLocationsScreen() {
  const navigation = useNavigation();
  const [pins, setPins] = useState<Pin[]>([]);

  // Reload on focus so a save/delete in the editor is reflected on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readPins().then((next) => {
        if (active) {
          setPins(next);
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={pins}
        keyExtractor={(pin) => pin.id}
        contentContainerStyle={
          pins.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Text style={styles.centeredTitle}>No pinned zones yet</Text>
            <Text style={styles.centeredBody}>
              Drop a pin on a spot — like your local masjid — to make it a
              silent zone, even if it isn&apos;t in our mosque data.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('PinEditor', { pinId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.label || 'unlabelled pin'}`}
          >
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.label || 'Unlabelled pin'}
              </Text>
              <Text style={styles.meta}>
                {formatRadius(item.radiusM)} radius
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={styles.addButton}
        onPress={() => navigation.navigate('PinEditor', {})}
        accessibilityRole="button"
      >
        <Text style={styles.addButtonText}>+ Add a pin</Text>
      </Pressable>
    </View>
  );
}

/** Metres → a short label: "150 m" under 1 km, else "1 km". */
function formatRadius(meters: number): string {
  if (meters < 1000) {
    return `${meters} m`;
  }
  return `${meters / 1000} km`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#999',
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
  chevron: {
    fontSize: 24,
    opacity: 0.4,
  },
  addButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0B6FB8',
  },
});
