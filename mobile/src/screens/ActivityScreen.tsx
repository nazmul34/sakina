import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import type { ActivityLogEntry } from '../../modules/ringer-control';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useActivityLog } from '../lib/activityLog';

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
  const { entries, clear } = useActivityLog();
  const [confirmVisible, setConfirmVisible] = useState(false);

  const sections = useMemo(() => groupByDay(entries), [entries]);

  const onConfirmClear = () => {
    setConfirmVisible(false);
    clear();
  };

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No activity yet</Text>
        <Text style={styles.emptyBody}>
          When auto-silent silences your phone near a mosque and restores it
          after you leave, those events show up here.
        </Text>
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
        renderItem={({ item }) => <ActivityRow entry={item} />}
        ListHeaderComponent={
          <Pressable
            style={styles.clearButton}
            onPress={() => setConfirmVisible(true)}
            accessibilityRole="button"
          >
            <Text style={styles.clearButtonText}>Clear log</Text>
          </Pressable>
        }
      />
      <ConfirmDialog
        visible={confirmVisible}
        title="Clear activity log?"
        message="This removes all recorded events. This can't be undone."
        confirmLabel="Clear"
        destructive
        onConfirm={onConfirmClear}
        onCancel={() => setConfirmVisible(false)}
      />
    </>
  );
}

function ActivityRow({ entry }: { entry: ActivityLogEntry }) {
  const silenced = entry.event === 'silenced';
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>{silenced ? '🔕' : '🔔'}</Text>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>
          {silenced ? 'Silenced' : 'Restored'} · {zoneLabel(entry.zone)}
        </Text>
        <Text style={styles.rowTime}>{formatTime(entry.at)}</Text>
      </View>
    </View>
  );
}

/**
 * Display name for a zone. Today the log stores the geofence region id (the only
 * identifier available); EPIC-02/03 will supply real mosque/pin names, at which
 * point this maps an id to that name.
 */
function zoneLabel(zone: string): string {
  return zone.length > 0 ? zone : 'a nearby zone';
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

const styles = StyleSheet.create({
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
  },
  emptyBody: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.7,
  },
  clearButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#FBE9E7',
    marginBottom: 8,
  },
  clearButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B3261E',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    opacity: 0.5,
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
    borderColor: '#999',
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
  },
  rowTime: {
    fontSize: 13,
    opacity: 0.6,
  },
});
