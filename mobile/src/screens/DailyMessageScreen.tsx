/**
 * Daily Islamic message screen (F-04.2 / FR-4.2).
 *
 * Shows one random active message from the backend with its source label.
 * Category chips (All / Qur'an / Hadith / Du'a / Reminder) let the user
 * narrow the pool; "Next" fetches another random pick from the same pool.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
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

  // Load on mount and whenever category changes.
  useEffect(() => {
    void load(category);
  }, [category, load]);

  const handleChip = (value: MessageCategory | undefined) => {
    if (value === category) return;
    setCategory(value);
  };

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
            <Text style={styles.errorTitle}>Couldn't load a message</Text>
            <Text style={styles.errorBody}>
              {errorDetail || 'Check your connection and try again.'}
            </Text>
          </View>
        )}
      </View>

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
