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

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { readPins, type Pin } from '../lib/pins';
import { trySyncPins } from '../lib/pinsSync';

export function PinnedLocationsScreen() {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const [pins, setPins] = useState<Pin[]>([]);

  // On focus, show local pins immediately (a save/delete in the editor is
  // reflected on return), then reconcile with the server in the background and
  // adopt the merged result. Sync is best-effort — offline, the local list stands.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readPins().then((next) => {
        if (active) {
          setPins(next);
        }
      });
      void trySyncPins().then((synced) => {
        if (active && synced) {
          setPins(synced);
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
            <Text style={styles.centeredTitle}>{t('pinned.emptyTitle')}</Text>
            <Text style={styles.centeredBody}>{t('pinned.emptyBody')}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => navigation.navigate('PinEditor', { pinId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={t('pinned.editLabel', {
              label: item.label || t('pinned.unlabelledForEdit'),
            })}
          >
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {item.label || t('pinned.unlabelled')}
              </Text>
              <Text style={styles.meta}>
                {t('pinned.radius', { radius: formatRadius(item.radiusM) })}
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
        <Text style={styles.addButtonText}>{t('pinned.addPin')}</Text>
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

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
    color: colors.text,
  },
  centeredBody: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 24,
    color: colors.muted,
  },
  addButton: {
    margin: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.info,
  },
});
