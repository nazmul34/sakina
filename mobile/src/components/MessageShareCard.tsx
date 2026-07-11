/**
 * Shareable image-card template for a daily message (F-04.4 / FR-4.3).
 *
 * A fixed 9:16 portrait card — sized for WhatsApp/Instagram stories & status —
 * rendered off-screen and captured to a PNG by the Daily message screen via
 * `react-native-view-shot`. The fixed pixel dimensions keep the export crisp and
 * consistent regardless of the device the user is on.
 *
 * Branding/template decision (documented in mobile/README.md → "Share image
 * card"): Sakina green field (#1A6B3C), centred message in a large serif-ish
 * weight, italic source label, and a "Sakina" wordmark + tagline footer so a
 * re-shared card always carries attribution back to the app.
 */

import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useT } from '../lib/i18n';
import type { IslamicMessage } from '../lib/messagesApi';

/** Logical card size (9:16). Captured at the device pixel ratio for a crisp PNG. */
export const CARD_WIDTH = 360;
export const CARD_HEIGHT = 640;

interface MessageShareCardProps {
  readonly message: IslamicMessage;
}

export const MessageShareCard = forwardRef<View, MessageShareCardProps>(
  function MessageShareCard({ message }, ref) {
    const t = useT();
    return (
      <View ref={ref} style={styles.card} collapsable={false}>
        <Text style={styles.kicker}>{t('shareCard.kicker')}</Text>

        <View style={styles.body}>
          <Text style={styles.quoteMark}>“</Text>
          <Text style={styles.message}>{message.text}</Text>
          {message.source_label.trim() !== '' && (
            <Text style={styles.source}>— {message.source_label}</Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.wordmark}>Sakina</Text>
          <Text style={styles.tagline}>{t('shareCard.tagline')}</Text>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#1A6B3C',
    paddingHorizontal: 32,
    paddingVertical: 40,
    justifyContent: 'space-between',
  },
  kicker: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quoteMark: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 64,
    lineHeight: 64,
    marginBottom: 4,
  },
  message: {
    color: '#FFFFFF',
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '600',
    textAlign: 'center',
  },
  source: {
    marginTop: 20,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
  },
  wordmark: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 1,
  },
});
