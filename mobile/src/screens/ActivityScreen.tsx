import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { ActivityLogEntry } from '../../modules/ringer-control';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { translate, useT } from '../lib/i18n';
import { useActivityLog } from '../lib/activityLog';
import { readAllPins } from '../lib/pins';

/**
 * Activity log screen (FR-1.8).
 *
 * Shows the device-local trail of auto-silent events — when the phone was
 * silenced entering a zone and restored leaving it — so the user can see the
 * feature working and trust it. The list re-reads on focus (via
 * {@link useActivityLog}), so events logged in the background appear on return.
 * Entries are grouped by day for scannability; retention is capped natively at
 * the most recent 100 events.
 */
export function ActivityScreen() {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const { entries, clear } = useActivityLog();
  const pinLabels = usePinLabels();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const sections = useMemo(() => groupByDay(entries), [entries]);

  const onConfirmClear = () => {
    setConfirmVisible(false);
    clear();
  };

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>{t('activity.empty')}</Text>
        <Text style={styles.emptyBody}>{t('activity.emptyBody')}</Text>
      </View>
    );
  }

  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.at}-${index}`}
        contentContainerStyle={styles.list}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item }) => (
          <ActivityRow entry={item} pinLabels={pinLabels} />
        )}
        ListHeaderComponent={
          <Pressable
            style={styles.clearButton}
            onPress={() => setConfirmVisible(true)}
            accessibilityRole="button"
          >
            <Text style={styles.clearButtonText}>{t('activity.clearLog')}</Text>
          </Pressable>
        }
      />
      <ConfirmDialog
        visible={confirmVisible}
        title={t('activity.clearTitle')}
        message={t('activity.clearMessage')}
        confirmLabel={t('activity.clear')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={onConfirmClear}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

function ActivityRow({
  entry,
  pinLabels,
}: {
  entry: ActivityLogEntry;
  pinLabels: Map<string, string>;
}) {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const silenced = entry.event === 'silenced';
  const zone = zoneLabel(entry.zone, pinLabels);
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{silenced ? '🔕' : '🔔'}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {silenced
            ? t('activity.silencedNear', { zone })
            : t('activity.restoredLeaving', { zone })}
        </Text>
        <Text style={styles.rowTime}>{formatTime(entry.at)}</Text>
      </View>
    </View>
  );
}

/**
 * A user-friendly name for the zone an event happened at — never the raw
 * geofence region id, which is a UUID/internal handle that means nothing to the
 * user. A pinned zone resolves to the label the user gave it (kept even after the
 * pin is deleted, via {@link readAllPins}); anything else is a nearby mosque
 * (EPIC-02 will supply their real names later).
 */
function zoneLabel(zone: string, pinLabels: Map<string, string>): string {
  if (pinLabels.has(zone)) {
    const label = pinLabels.get(zone)?.trim();
    return label && label.length > 0 ? label : translate('activity.pinnedZone');
  }
  return translate('activity.nearbyMosque');
}

/**
 * Live map of pin id → the user's label, refreshed on focus, so the log can show
 * a pin's name instead of its id. Uses {@link readAllPins} (tombstones included)
 * so an event recorded before a pin was deleted still resolves to its name.
 */
function usePinLabels(): Map<string, string> {
  const [labels, setLabels] = useState<Map<string, string>>(() => new Map());
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void readAllPins().then((pins) => {
        if (active) {
          setLabels(new Map(pins.map((p) => [p.id, p.label])));
        }
      });
      return () => {
        active = false;
      };
    }, []),
  );
  return labels;
}

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function formatTime(at: number): string {
  return timeFormatter.format(new Date(at));
}

interface DaySection {
  title: string;
  data: ActivityLogEntry[];
}

/** Group entries (already newest-first) into contiguous day sections. */
function groupByDay(entries: ActivityLogEntry[]): DaySection[] {
  const sections: DaySection[] = [];
  for (const entry of entries) {
    const title = dayFormatter.format(new Date(entry.at));
    const last = sections[sections.length - 1];
    if (last && last.title === title) {
      last.data.push(entry);
    } else {
      sections.push({ title, data: [entry] });
    }
  }
  return sections;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  list: {
    padding: 20,
    gap: 8,
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
    textAlign: 'center',
    color: colors.textMuted,
  },
  clearButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.dangerTint,
    marginBottom: 8,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.danger,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 4,
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
  icon: {
    fontSize: 20,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  rowTime: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
