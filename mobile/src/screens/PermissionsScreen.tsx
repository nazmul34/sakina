import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import {
  checkPermissions,
  fixPermission,
  type PermissionItem,
  type PermissionKey,
} from '../lib/permissions';

/**
 * Permissions checklist for auto-silent (FR-1.6).
 *
 * Lists the four grants auto-silent needs, each with live granted/denied status
 * and a "Fix" button that requests the permission or deep-links to the right
 * system screen. Status re-checks whenever the screen regains focus and whenever
 * the app returns to the foreground — so a grant made in system settings shows up
 * the moment the user comes back, without a manual refresh.
 */
export function PermissionsScreen() {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const [items, setItems] = useState<PermissionItem[] | null>(null);
  const [busy, setBusy] = useState<PermissionKey | null>(null);

  const refresh = useCallback(() => {
    void checkPermissions().then(setItems);
  }, []);

  // Re-check on focus (initial mount + returning from another screen).
  useFocusEffect(refresh);

  // Re-check when the app comes back to the foreground (returning from the
  // external system settings the "Fix" buttons open).
  useFocusEffect(
    useCallback(() => {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          refresh();
        }
      });
      return () => sub.remove();
    }, [refresh]),
  );

  const onFix = useCallback(
    (key: PermissionKey) => {
      setBusy(key);
      void fixPermission(key)
        .catch(() => {})
        .finally(() => {
          setBusy(null);
          // Catches in-app grants (location dialogs) that don't background us.
          refresh();
        });
    },
    [refresh],
  );

  const allGranted = items?.every((item) => item.granted) ?? false;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>{t('permissions.intro')}</Text>

      {items === null ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <>
          {allGranted && (
            <View style={styles.allSet}>
              <Text style={styles.allSetText}>{t('permissions.allSet')}</Text>
            </View>
          )}
          {items.map((item) => (
            <PermissionRow
              key={item.key}
              item={item}
              busy={busy === item.key}
              onFix={() => onFix(item.key)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function PermissionRow({
  item,
  busy,
  onFix,
}: {
  item: PermissionItem;
  busy: boolean;
  onFix: () => void;
}) {
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const title = t(item.titleKey);
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.statusDot}>{item.granted ? '🟢' : '🔴'}</Text>
          <Text style={styles.rowTitle}>{title}</Text>
        </View>
        <Text style={styles.rowDescription}>{t(item.descKey)}</Text>
      </View>

      {item.granted ? (
        <Text style={styles.grantedLabel}>{t('permissions.granted')}</Text>
      ) : (
        <Pressable
          style={[styles.fixButton, busy && styles.fixButtonBusy]}
          onPress={onFix}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('permissions.fixLabel', { title })}
        >
          <Text style={styles.fixButtonText}>
            {busy ? '…' : t('permissions.fix')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    padding: 20,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 4,
  },
  loading: {
    marginTop: 32,
  },
  allSet: {
    backgroundColor: colors.successTint,
    borderRadius: 10,
    padding: 12,
  },
  allSetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    fontSize: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    color: colors.text,
  },
  rowDescription: {
    fontSize: 13,
    color: colors.textMuted,
  },
  grantedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.success,
  },
  fixButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.accentBlue,
  },
  fixButtonBusy: {
    opacity: 0.5,
  },
  fixButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.info,
  },
});
