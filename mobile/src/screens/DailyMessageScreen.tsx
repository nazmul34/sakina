/**
 * Daily Islamic message screen (F-04.2 → F-04.5 / FR-4.2 / FR-4.3 / FR-4.4).
 *
 * Shows one random active message from the backend with its source label.
 * Category chips (All / Qur'an / Hadith / Du'a / Reminder) let the user
 * narrow the pool; "Next" fetches another random pick from the same pool;
 * "Share" hands the text + source label to the OS native share sheet; the
 * heart saves the message to the offline favorites list (F-04.5).
 */

import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { MessageShareCard } from '../components/MessageShareCard';
import { useFavorites } from '../lib/favorites';
import {
  composeShareText,
  fetchRandomMessage,
  type IslamicMessage,
  type MessageCategory,
} from '../lib/messagesApi';

interface CategoryChip {
  readonly label: string;
  readonly value: MessageCategory | undefined;
}

const CHIPS: CategoryChip[] = [
  { label: 'All', value: undefined },
  { label: "Qur'an", value: 'quran' },
  { label: 'Hadith', value: 'hadith' },
  { label: "Du'a", value: 'dua' },
  { label: 'Reminder', value: 'reminder' },
];

type Status = 'loading' | 'success' | 'empty' | 'error';

export function DailyMessageScreen() {
  const [category, setCategory] = useState<MessageCategory | undefined>(
    undefined,
  );
  const [message, setMessage] = useState<IslamicMessage | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [errorDetail, setErrorDetail] = useState<string>('');
  const [imageBusy, setImageBusy] = useState(false);

  // Off-screen image card captured to a PNG for image sharing (F-04.4).
  const cardRef = useRef<View>(null);

  // Offline favorites (F-04.5). `isSaved` reflects the current message's state.
  const { favorites, toggleFavorite } = useFavorites();
  const isSaved =
    message !== null && favorites.some((m) => m.id === message.id);

  const load = useCallback(
    async (cat: MessageCategory | undefined) => {
      setStatus('loading');
      setErrorDetail('');
      try {
        const msg = await fetchRandomMessage(cat);
        setMessage(msg);
        setStatus('success');
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        if (detail.includes('404') || detail.toLowerCase().includes('no messages')) {
          setStatus('empty');
        } else {
          setErrorDetail(detail);
          setStatus('error');
        }
      }
    },
    [],
  );

  // Load on mount and whenever category changes. Deferring through a microtask
  // keeps the initial setState off the synchronous effect path (the loading
  // state is set inside `load`), so it doesn't cascade renders.
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) {
        void load(category);
      }
    });
    return () => {
      active = false;
    };
  }, [category, load]);

  const handleChip = (value: MessageCategory | undefined) => {
    if (value === category) return;
    setCategory(value);
  };

  // Open the OS native share sheet with the message text + source label
  // (F-04.3). A rejected promise here is a benign user cancel / no-sharer, so
  // we swallow it rather than surfacing an error.
  const handleShare = useCallback(async (msg: IslamicMessage) => {
    try {
      await Share.share({ message: composeShareText(msg) });
    } catch {
      // ignore — cancelling the share sheet is not an error worth showing
    }
  }, []);

  // Render the off-screen card to a PNG and hand the file to the OS share sheet
  // (F-04.4). `expo-sharing` shares the file via a content URI, which is what
  // Android's share targets (stories/status) expect.
  const handleShareImage = useCallback(async () => {
    if (cardRef.current === null) return;
    setImageBusy(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Image sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share message card',
        UTI: 'public.png',
      });
    } catch {
      Alert.alert('Could not create image', 'Something went wrong rendering the card.');
    } finally {
      setImageBusy(false);
    }
  }, []);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      alwaysBounceVertical={false}
    >
      {/* Category filter chips */}
      <View style={styles.chips} accessibilityRole="tablist">
        {CHIPS.map((chip) => {
          const selected = chip.value === category;
          return (
            <Pressable
              key={chip.label}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleChip(chip.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Filter by ${chip.label}`}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content area */}
      <View style={styles.card}>
        {status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        )}

        {status === 'success' && message !== null && (
          <>
            <Pressable
              style={styles.heart}
              onPress={() => toggleFavorite(message)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSaved }}
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save message'}
              hitSlop={12}
            >
              <Text style={[styles.heartIcon, isSaved && styles.heartIconOn]}>
                {isSaved ? '♥' : '♡'}
              </Text>
            </Pressable>
            <Text style={styles.messageText}>{message.text}</Text>
            {message.source_label !== '' && (
              <Text style={styles.sourceLabel}>{message.source_label}</Text>
            )}
          </>
        )}

        {status === 'empty' && (
          <View style={styles.centered}>
            <Text style={styles.emptyTitle}>No messages</Text>
            <Text style={styles.emptyBody}>
              There are no messages in this category yet.
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.centered}>
            <Text style={styles.errorTitle}>{"Couldn't load a message"}</Text>
            <Text style={styles.errorBody}>
              {errorDetail || 'Check your connection and try again.'}
            </Text>
          </View>
        )}
      </View>

      {/* Share buttons — only meaningful when a message is on screen */}
      {status === 'success' && message !== null && (
        <>
          {/* Plain-text share (F-04.3) */}
          <Pressable
            style={styles.shareButton}
            onPress={() => void handleShare(message)}
            accessibilityRole="button"
            accessibilityLabel="Share this message as text"
          >
            <Text style={styles.shareButtonText}>Share text</Text>
          </Pressable>

          {/* Rendered image-card share (F-04.4) */}
          <Pressable
            style={[
              styles.shareImageButton,
              imageBusy && styles.nextButtonDisabled,
            ]}
            onPress={() => void handleShareImage()}
            disabled={imageBusy}
            accessibilityRole="button"
            accessibilityLabel="Share this message as an image card"
          >
            <Text style={styles.shareImageButtonText}>
              {imageBusy ? 'Preparing image…' : 'Share as image'}
            </Text>
          </Pressable>
        </>
      )}

      {/* Next / retry button */}
      <Pressable
        style={[
          styles.nextButton,
          status === 'loading' && styles.nextButtonDisabled,
        ]}
        onPress={() => void load(category)}
        disabled={status === 'loading'}
        accessibilityRole="button"
        accessibilityLabel={status === 'error' ? 'Try again' : 'Next message'}
      >
        <Text style={styles.nextButtonText}>
          {status === 'error' ? 'Try again' : 'Next message'}
        </Text>
      </Pressable>

      {/*
        Off-screen render target for the image card (F-04.4). Kept invisible
        (opacity 0, non-interactive) but still laid out so view-shot can capture
        it. Only mounted when there's a message to render.
      */}
      {message !== null && (
        <View style={styles.offscreen} pointerEvents="none">
          <MessageShareCard ref={cardRef} message={message} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    gap: 16,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  chipSelected: {
    backgroundColor: '#1A6B3C',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  chipTextSelected: {
    color: '#fff',
  },
  card: {
    minHeight: 200,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D0D0D0',
    backgroundColor: '#FAFAFA',
    padding: 24,
    justifyContent: 'center',
  },
  centered: {
    alignItems: 'center',
    gap: 8,
  },
  heart: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 4,
  },
  heartIcon: {
    fontSize: 26,
    color: '#B0B0B0',
  },
  heartIconOn: {
    color: '#B3261E',
  },
  messageText: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '500',
    color: '#111',
  },
  sourceLabel: {
    marginTop: 16,
    fontSize: 13,
    opacity: 0.55,
    fontStyle: 'italic',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
  },
  shareButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1A6B3C',
    alignItems: 'center',
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  shareImageButton: {
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#1A6B3C',
    alignItems: 'center',
  },
  shareImageButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A6B3C',
  },
  // Parked off-screen and fully transparent: laid out (so the capture has real
  // pixels) but never visible or interactive to the user.
  offscreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0,
  },
  nextButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#E6F4FE',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.45,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
