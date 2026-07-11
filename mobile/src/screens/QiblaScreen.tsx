/**
 * Qibla compass screen (FR-6.1, EPIC-06).
 *
 * Shows a live compass with a Kaaba (🕋) marker that points toward Mecca. It
 * takes a one-shot high-accuracy fix ({@link getHighAccuracyFix}) to compute the
 * absolute Qibla bearing ({@link qiblaBearing}) and subscribes to the device
 * heading ({@link useDeviceHeading}). The whole rose counter-rotates with the
 * heading so N tracks true north, and the Kaaba marker sits on it at the Qibla
 * bearing — landing under the top index (and highlighting) when the user faces
 * the Qibla ({@link qiblaRotation} within a few degrees of 0).
 *
 * Calibration prompts (F-06.2) and a richer no-magnetometer fallback (F-06.3)
 * are tracked separately; this screen handles the happy path plus the basic
 * "no sensor / no location permission" messages so it never crashes.
 */

import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { useT } from '../lib/i18n';
import { useDeviceHeading } from '../hooks/useDeviceHeading';
import { useHighAccuracyLocation } from '../hooks/useHighAccuracyLocation';
import { qiblaBearing, qiblaRotation } from '../lib/qibla';

/** The Kaaba glyph used as the Qibla marker on the compass rose. */
const KAABA_GLYPH = '🕋';

/** Cardinal points, placed on the rose at their true bearings. */
const CARDINALS: readonly { deg: number; label: string }[] = [
  { deg: 0, label: 'N' },
  { deg: 90, label: 'E' },
  { deg: 180, label: 'S' },
  { deg: 270, label: 'W' },
];

/** Tick marks around the rose (every 30°; the cardinals read as major ticks). */
const TICKS: readonly number[] = [
  0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330,
];

/** Diameter of the compass dial and its radius, in px. */
const DIAL = 300;
const RADIUS = DIAL / 2;

/** How close to the Qibla (degrees) counts as "facing it". */
const ALIGN_TOLERANCE_DEG = 6;

export function QiblaScreen() {
  const navigation = useNavigation();
  const styles = useThemedStyles(makeStyles);
  const t = useT();
  // Recovers on its own once location is enabled (the hook retries on
  // foreground), so the compass appears without needing an app restart.
  const { location, status: locationStatus } = useHighAccuracyLocation();
  const { heading, isAvailable } = useDeviceHeading();

  if (locationStatus === 'denied') {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>{t('qibla.locationNeeded')}</Text>
        <Text style={styles.centeredBody}>
          {t('qibla.locationNeededBody')}
        </Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => navigation.navigate('Permissions')}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>
            {t('qibla.setupPermissions')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (locationStatus === 'error') {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>{t('qibla.couldntFind')}</Text>
        <Text style={styles.centeredBody}>{t('qibla.couldntFindBody')}</Text>
      </View>
    );
  }

  if (location === null || isAvailable === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
        <Text style={styles.centeredBody}>{t('qibla.finding')}</Text>
      </View>
    );
  }

  const bearing = qiblaBearing(location);

  // No magnetometer: show the absolute bearing as a number so the feature is
  // still useful. The full graceful-degradation experience is F-06.3.
  if (isAvailable === false) {
    return (
      <View style={styles.centered}>
        <Text style={styles.centeredTitle}>{t('qibla.noSensor')}</Text>
        <Text style={styles.centeredBody}>
          {t('qibla.noSensorBefore')}
          <Text style={styles.bold}>{Math.round(bearing)}°</Text>
          {t('qibla.noSensorAfter')}
        </Text>
      </View>
    );
  }

  // Rotate the whole rose opposite the heading so N tracks true north as the
  // phone turns; the Kaaba marker lives on the rose at the absolute Qibla
  // bearing, so it ends up at `bearing - heading` on screen — straight up when
  // the user faces the Qibla. Before the first reading, hold the rose at north.
  const headingDeg = heading ?? 0;
  const rotation = heading == null ? 0 : qiblaRotation(bearing, heading);
  const offBy = Math.min(rotation, 360 - rotation);
  const aligned = heading != null && offBy <= ALIGN_TOLERANCE_DEG;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('qibla.heading')}</Text>
      <Text style={styles.subtitle}>
        {aligned
          ? t('qibla.facingSubtitle', { kaaba: KAABA_GLYPH })
          : t('qibla.turnSubtitle', { kaaba: KAABA_GLYPH })}
      </Text>

      <View style={styles.dialWrap}>
        <View style={[styles.dial, aligned && styles.dialAligned]}>
          <View style={styles.innerRing} />

          {/* The rotating compass rose: ticks, cardinals and the Kaaba marker
              all sit on it, so they track true north together. */}
          <View
            style={[styles.rose, { transform: [{ rotate: `${-headingDeg}deg` }] }]}
            accessibilityLabel={`Qibla is ${Math.round(bearing)} degrees from north`}
          >
            {TICKS.map((deg) => (
              <View
                key={`t${deg}`}
                style={[styles.ray, { transform: [{ rotate: `${deg}deg` }] }]}
              >
                <View style={[styles.tick, deg % 90 === 0 && styles.tickMajor]} />
              </View>
            ))}

            {CARDINALS.map(({ deg, label }) => (
              <View
                key={label}
                style={[styles.ray, { transform: [{ rotate: `${deg}deg` }] }]}
              >
                <Text
                  style={[styles.cardinal, label === 'N' && styles.cardinalNorth]}
                >
                  {label}
                </Text>
              </View>
            ))}

            {/* The Qibla pointer: a needle to the Kaaba at its true bearing. */}
            <View
              style={[styles.ray, { transform: [{ rotate: `${bearing}deg` }] }]}
            >
              <View style={styles.qiblaPointer}>
                <View
                  style={[styles.kaabaBadge, aligned && styles.kaabaBadgeAligned]}
                >
                  <Text style={styles.kaaba}>{KAABA_GLYPH}</Text>
                </View>
                <View
                  style={[styles.needleLine, aligned && styles.needleLineAligned]}
                />
              </View>
            </View>
          </View>

          <View style={styles.hub} />
        </View>

        {/* Fixed index at the top = the direction the phone is pointing. Drawn
            after the dial and lifted above it so Android elevation can't hide it. */}
        <View style={[styles.topIndex, aligned && styles.topIndexAligned]} />
      </View>

      <View style={[styles.readoutCard, aligned && styles.readoutCardAligned]}>
        <Text style={styles.readoutValue}>{Math.round(bearing)}°</Text>
        <Text style={styles.readoutLabel}>
          {aligned ? t('qibla.facingReadout') : t('qibla.fromNorth')}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 18,
    backgroundColor: colors.background,
  },
  heading: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: colors.textMuted,
    maxWidth: 300,
  },
  dialWrap: {
    width: DIAL,
    height: DIAL,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  // The downward triangle at the top: the reference the Kaaba should reach.
  topIndex: {
    position: 'absolute',
    top: -2,
    zIndex: 10,
    elevation: 6,
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.borderStrong,
  },
  topIndexAligned: {
    borderTopColor: colors.brandSolid,
  },
  dial: {
    width: DIAL,
    height: DIAL,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft lift so the compass reads as a physical instrument.
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dialAligned: {
    borderColor: colors.brand,
  },
  innerRing: {
    position: 'absolute',
    width: DIAL - 56,
    height: DIAL - 56,
    borderRadius: (DIAL - 56) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.brandTint,
    opacity: 0.5,
  },
  // Full-dial layer that rotates with the heading; children pin to the top edge
  // and rotate around the centre to their bearing.
  rose: {
    position: 'absolute',
    width: DIAL,
    height: DIAL,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ray: {
    position: 'absolute',
    width: DIAL,
    height: DIAL,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  tick: {
    marginTop: 8,
    width: 2,
    height: 9,
    borderRadius: 1,
    backgroundColor: colors.borderStrong,
  },
  tickMajor: {
    width: 3,
    height: 15,
    backgroundColor: colors.brand,
  },
  cardinal: {
    marginTop: 22,
    fontSize: 16,
    fontWeight: '800',
    color: colors.textMuted,
  },
  cardinalNorth: {
    color: colors.danger,
  },
  qiblaPointer: {
    marginTop: 34,
    height: RADIUS - 34,
    alignItems: 'center',
  },
  kaabaBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.brand,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kaabaBadgeAligned: {
    backgroundColor: colors.brandTint,
    borderColor: colors.brandSolid,
  },
  kaaba: {
    fontSize: 24,
    lineHeight: 30,
  },
  needleLine: {
    flex: 1,
    width: 4,
    borderRadius: 2,
    backgroundColor: colors.brand,
  },
  needleLineAligned: {
    backgroundColor: colors.brandSolid,
    width: 5,
  },
  hub: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brandSolid,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  readoutCard: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minWidth: 160,
  },
  readoutCardAligned: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint,
  },
  readoutValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  readoutLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
    backgroundColor: colors.background,
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
  bold: {
    fontWeight: '700',
    color: colors.text,
  },
  primaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: colors.brandSolid,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.onBrand,
  },
});
