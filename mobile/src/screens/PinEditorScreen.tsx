/**
 * Drop / edit a pinned silent zone (FR-3.1).
 *
 * Hosts the {@link PinMap} (tap-to-drop, draggable marker over OSM tiles) plus the
 * two per-pin controls — a label field and a radius preset row — and persists the
 * result with {@link savePin}. Opened fresh (no params) to create a pin centred on
 * the user's current location, or with a `pinId` to edit an existing one in place.
 */

import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ConfirmDialog } from '../components/ConfirmDialog';
import { PinMap } from '../components/PinMap';
import { useColors, useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { armGeofencing } from '../lib/geofencing';
import type { LatLng } from '../lib/geofencing/types';
import { getHighAccuracyFix } from '../lib/location';
import {
  DEFAULT_PIN_RADIUS_M,
  PIN_PRESETS,
  PIN_RADIUS_PRESETS_M,
  deletePin,
  readPins,
  savePin,
  type Pin,
  type PinPreset,
} from '../lib/pins';
import type { RootStackParamList } from '../navigation/types';

// Used only when we can't get a location fix and aren't editing an existing pin,
// so the map still has somewhere to start from and the user can pan/tap from there.
const FALLBACK_CENTER: LatLng = { latitude: 21.4225, longitude: 39.8262 }; // Kaaba

export function PinEditorScreen() {
  const navigation = useNavigation();
  const c = useColors();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  const { params } = useRoute<RouteProp<RootStackParamList, 'PinEditor'>>();
  const pinId = params?.pinId;

  // The map mounts once we have a centre; until then we show a spinner. `position`
  // tracks the live marker; `center` is the fixed initial view and never changes.
  const [center, setCenter] = useState<LatLng | null>(null);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [label, setLabel] = useState('');
  const [radiusM, setRadiusM] = useState<number>(DEFAULT_PIN_RADIUS_M);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    let active = true;

    async function init() {
      if (pinId) {
        const existing = (await readPins()).find((p) => p.id === pinId);
        if (existing && active) {
          seedFromPin(existing);
          return;
        }
      }
      // New pin: centre on the user. If location is unavailable, fall back so the
      // map is still usable — the user can pan and tap to place the pin manually.
      const fix = await getHighAccuracyFix().catch(() => FALLBACK_CENTER);
      if (active) {
        setCenter(fix);
        setPosition(fix);
      }
    }

    function seedFromPin(pin: Pin) {
      const at = { latitude: pin.latitude, longitude: pin.longitude };
      setCenter(at);
      setPosition(at);
      setLabel(pin.label);
      setRadiusM(pin.radiusM);
    }

    void init();
    return () => {
      active = false;
    };
  }, [pinId]);

  function applyPreset(preset: PinPreset) {
    setLabel(preset.label);
    setRadiusM(preset.radiusM);
  }

  async function handleSave() {
    if (!position) {
      return;
    }
    await savePin(
      {
        label: label.trim(),
        latitude: position.latitude,
        longitude: position.longitude,
        radiusM,
      },
      pinId,
    );
    // Fold the new/edited zone into the live geofence set (FR-3.3). Fire-and-forget
    // and best-effort — armGeofencing no-ops when auto-silent is off or permissions
    // are missing, and the pin is already persisted, so we don't block the UI on it.
    void armGeofencing();
    navigation.goBack();
  }

  async function handleDelete() {
    if (pinId) {
      await deletePin(pinId);
      // Drop the removed zone from the live geofence set (FR-3.3); same
      // best-effort re-arm as on save.
      void armGeofencing();
    }
    setConfirmingDelete(false);
    navigation.goBack();
  }

  if (!center) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.centeredBody}>{t('pinEditor.findingLocation')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        <PinMap center={center} radiusM={radiusM} onMove={setPosition} />
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={styles.panelContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.hint}>{t('pinEditor.tapHint')}</Text>

        {!pinId ? (
          <>
            <Text style={styles.fieldLabel}>{t('pinEditor.suggested')}</Text>
            <View style={styles.presets}>
              {PIN_PRESETS.map((preset) => {
                const selected =
                  label === preset.label && radiusM === preset.radiusM;
                return (
                  <Pressable
                    key={preset.label}
                    style={[styles.preset, selected && styles.presetSelected]}
                    onPress={() => applyPreset(preset)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.presetText,
                        selected && styles.presetTextSelected,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={styles.fieldLabel}>{t('pinEditor.label')}</Text>
        <TextInput
          style={styles.input}
          value={label}
          onChangeText={setLabel}
          placeholder={t('pinEditor.labelPlaceholder')}
          placeholderTextColor={c.muted}
          returnKeyType="done"
          maxLength={60}
        />

        <Text style={styles.fieldLabel}>{t('pinEditor.radius')}</Text>
        <View style={styles.presets}>
          {PIN_RADIUS_PRESETS_M.map((preset) => {
            const selected = preset === radiusM;
            return (
              <Pressable
                key={preset}
                style={[styles.preset, selected && styles.presetSelected]}
                onPress={() => setRadiusM(preset)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.presetText,
                    selected && styles.presetTextSelected,
                  ]}
                >
                  {formatRadius(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.saveButton, !position && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!position}
          accessibilityRole="button"
        >
          <Text style={styles.saveButtonText}>
            {pinId ? t('pinEditor.saveChanges') : t('pinEditor.savePin')}
          </Text>
        </Pressable>

        {pinId ? (
          <Pressable
            style={styles.deleteButton}
            onPress={() => setConfirmingDelete(true)}
            accessibilityRole="button"
          >
            <Text style={styles.deleteButtonText}>
              {t('pinEditor.deletePin')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <ConfirmDialog
        visible={confirmingDelete}
        title={t('pinEditor.deleteTitle')}
        message={t('pinEditor.deleteMessage')}
        confirmLabel={t('pinEditor.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
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
  mapWrap: {
    flex: 1,
    minHeight: 220,
  },
  panel: {
    maxHeight: '52%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  panelContent: {
    padding: 16,
    gap: 8,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  presetSelected: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.info,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
  },
  presetTextSelected: {
    color: colors.info,
  },
  saveButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.info,
  },
  deleteButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  centeredBody: {
    fontSize: 14,
    textAlign: 'center',
    color: colors.textMuted,
  },
});
