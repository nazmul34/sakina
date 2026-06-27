/**
 * Saved messages screen (F-04.5 / FR-4.4).
 *
 * Lists the messages the user has favorited on the Daily message screen. The
 * list is read from the on-device store ([[favorites]]), so it works fully
 * offline — no network call. Each row can be shared (text) or unsaved.
 */

import {
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useFavorites } from '../lib/favorites';
import { composeShareText, type IslamicMessage } from '../lib/messagesApi';

const CATEGORY_LABELS: Record<IslamicMessage['category'], string> = {
  quran: "Qur'an",
  hadith: 'Hadith',
  dua: "Du'a",
  reminder: 'Reminder',
};

export function SavedMessagesScreen() {
  const styles = useThemedStyles(makeStyles);
  const { favorites, removeFavorite } = useFavorites();

  if (favorites.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No saved messages</Text>
        <Text style={styles.emptyBody}>
          Tap the heart on a daily message to save it here. Your saved list is
          available offline.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={favorites}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.category}>{CATEGORY_LABELS[item.category]}</Text>
          <Text style={styles.messageText}>{item.text}</Text>
          {item.source_label.trim() !== '' && (
            <Text style={styles.sourceLabel}>— {item.source_label}</Text>
          )}

          <View style={styles.actions}>
            <Pressable
              style={styles.action}
              onPress={() => {
                void Share.share({ message: composeShareText(item) }).catch(
                  () => {},
                );
              }}
              accessibilityRole="button"
              accessibilityLabel="Share this message as text"
            >
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
            <Pressable
              style={styles.action}
              onPress={() => removeFavorite(item.id)}
              accessibilityRole="button"
              accessibilityLabel="Remove from saved"
            >
              <Text style={[styles.actionText, styles.removeText]}>Remove</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 18,
  },
  category: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.brand,
    marginBottom: 8,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.text,
  },
  sourceLabel: {
    marginTop: 10,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  action: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  removeText: {
    color: colors.danger,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
