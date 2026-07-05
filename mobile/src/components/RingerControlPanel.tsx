import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import RingerControl, { type RingerMode } from '../../modules/ringer-control';
import { useThemedStyles, type ThemeColors } from '../lib/colors';
import { isAutoSilentEnabled } from '../lib/autoSilentSettings';
import { sendTestPrayerNotification } from '../lib/prayerNotifications';
import { ConfirmDialog } from './ConfirmDialog';

const MODES: RingerMode[] = ['silent', 'vibrate', 'normal'];

/** Synthetic region id used by the manual zone-trigger buttons. */
const TEST_ZONE = 'test-zone';

/**
 * Display-only mirror of the native grace timers (see `RingerHysteresis.kt`:
 * `DWELL_MS` / `EXIT_BUFFER_MS`). Native AlarmManager remains the real source of
 * truth for when silence/restore actually fire; these just drive the dev panel's
 * countdown so QA can *see* when it's about to happen. Keep in sync with native.
 */
const DWELL_MS = 45_000;
const EXIT_BUFFER_MS = 20_000;

/**
 * How long to wait for the native commit alarm after the grace elapses before
 * flagging it as deferred. The dwell/exit timers fire via `setAndAllowWhileIdle`,
 * which the OS can delay for a *manually* triggered test (no preceding geofence
 * wake) when the app isn't battery-exempt — so the actual silence/restore can
 * land tens of seconds after the grace. Beyond this we stop waiting and explain.
 */
const CONFIRM_TIMEOUT_MS = 90_000;

/** Which grace timer the panel is currently counting down, if any. */
type Countdown = { kind: 'dwell' | 'exit'; endsAt: number };

/**
 * After the grace elapses, the native outcome the panel is polling to confirm —
 * `silence` waits for a zone to go active, `restore` waits for the last to clear.
 */
type Awaiting = { kind: 'silence' | 'restore'; since: number };

type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'muted';

/**
 * Dev/QA panel that exercises the native `RingerControl` module directly — a
 * manual harness for the F-00.2 ringer primitives and, via the zone Enter/Exit
 * buttons, the full F-01.3/1.4/1.5/1.8/1.9 state machine without needing real
 * geofence data (EPIC-02/03) or physical movement.
 *
 * The Enter/Exit buttons feed the same `onZoneEnter`/`onZoneExit` seam the
 * background geofencing task uses, so they drive the genuine dwell → silence →
 * exit-buffer → restore flow (and its activity log + failure warnings), just on
 * demand instead of from GPS. The panel adds three QA affordances on top:
 *
 *  - a live **countdown** mirroring the native dwell/exit grace, so it's obvious
 *    when silence/restore will fire rather than guessing at the 45 s / 20 s waits;
 *  - a plain-language **status line** explaining what the state machine is doing
 *    (and, crucially, *why* it didn't silence when expected);
 *  - a **prerequisites checklist** (master toggle, DND, notifications, battery)
 *    so a "nothing happened" report is one glance to diagnose.
 *
 * Rendered only in dev builds (gated by `__DEV__` at the call site) — production
 * never shows this section, nor the API/device footer beside it.
 */
export function RingerControlPanel() {
  const styles = useThemedStyles(makeStyles);
  // The native getters are synchronous, so we can seed state lazily on first
  // render rather than syncing it from an effect.
  const [deviceId, setDeviceId] = useState(() => RingerControl.getDeviceId());
  const [dndGranted, setDndGranted] = useState(() =>
    RingerControl.isDndAccessGranted(),
  );
  const [ringerMode, setRingerModeState] = useState<RingerMode>(() =>
    RingerControl.getRingerMode(),
  );
  const [silenceMode, setSilenceMode] = useState(() =>
    RingerControl.getSilenceMode(),
  );
  const [activeZones, setActiveZones] = useState(() =>
    RingerControl.activeZoneCount(),
  );
  const [masterEnabled, setMasterEnabled] = useState(() => isAutoSilentEnabled());
  const [notificationsEnabled, setNotificationsEnabled] = useState(() =>
    RingerControl.areNotificationsEnabled(),
  );
  const [batteryExempt, setBatteryExempt] = useState(() =>
    RingerControl.isIgnoringBatteryOptimizations(),
  );
  const [dndPromptVisible, setDndPromptVisible] = useState(false);
  // Dev-only mirror of the prayer-aware gate the buttons below drive. The native
  // store has no getter, so this reflects what *this panel* last set — enough to
  // exercise "tighten around prayer" without waiting for a real prayer time.
  const [prayerGate, setPrayerGate] = useState<'off' | 'open' | 'closed'>('off');

  // Grace-timer + confirmation bookkeeping. `countdown` is the precise dwell/exit
  // grace (mirrors native). When it elapses the *actual* silence/restore is done
  // by a native AlarmManager alarm that — unlike production, where a geofence
  // event has just woken the device — can be deferred by the OS for a manually
  // triggered test (App Standby / no battery exemption). So instead of assuming
  // it's done at 0s, we move into `awaiting` and poll native until the zone really
  // commits; `notice` holds a one-off explanation if the alarm never fires in time.
  const [countdown, setCountdown] = useState<Countdown | null>(null);
  const [awaiting, setAwaiting] = useState<Awaiting | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // A dwell/exit countdown polled from native for a *real* geofence-driven
  // silence (e.g. a pinned zone). Distinct from `countdown`, which the manual
  // Enter/Exit buttons drive with a precise local clock. Only one is shown at a
  // time — the manual one wins while a test is mid-flight.
  const [livePending, setLivePending] = useState<{
    kind: 'dwell' | 'exit';
    remainingSec: number;
  } | null>(null);
  // Post-grace "applying" phase for the *real* geofence-driven path — the mirror
  // of the manual buttons' `awaiting`. Native's dwell/exit grace has elapsed but
  // the commit alarm hasn't fired yet, so the phone isn't silenced/restored *yet*
  // (the OS can defer the alarm when the app isn't battery-exempt). Without this
  // the panel would sit on a stuck "Silencing in 0s" instead of saying it's
  // applying; `liveNotice` explains it if the alarm never lands in time.
  const [liveApplying, setLiveApplying] = useState<{
    kind: 'dwell' | 'exit';
    since: number;
  } | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const liveApplyingSinceRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setDndGranted(RingerControl.isDndAccessGranted());
    setRingerModeState(RingerControl.getRingerMode());
    setSilenceMode(RingerControl.getSilenceMode());
    setDeviceId(RingerControl.getDeviceId());
    setActiveZones(RingerControl.activeZoneCount());
    setMasterEnabled(isAutoSilentEnabled());
    setNotificationsEnabled(RingerControl.areNotificationsEnabled());
    setBatteryExempt(RingerControl.isIgnoringBatteryOptimizations());
  }, []);

  // Tick the precise grace countdown; when it elapses, hand off to the polling
  // phase — the deferrable native alarm that actually silences/restores may not
  // have fired yet, so we don't claim it's done.
  useEffect(() => {
    if (!countdown) return;
    const id = setInterval(() => {
      if (Date.now() >= countdown.endsAt) {
        const kind = countdown.kind === 'dwell' ? 'silence' : 'restore';
        setCountdown(null);
        setNotice(null);
        setAwaiting({ kind, since: Date.now() });
      } else {
        setNow(Date.now());
      }
    }, 250);
    return () => clearInterval(id);
  }, [countdown]);

  // Poll native until the grace's outcome actually lands (silence: a zone goes
  // active; restore: the last zone clears), then re-read state. If the deferrable
  // alarm hasn't fired within the timeout, stop and explain — almost always the
  // missing battery-optimisation exemption.
  useEffect(() => {
    if (!awaiting) return;
    const id = setInterval(() => {
      const count = RingerControl.activeZoneCount();
      const landed = awaiting.kind === 'silence' ? count > 0 : count === 0;
      if (landed) {
        setAwaiting(null);
        refresh();
      } else if (Date.now() - awaiting.since > CONFIRM_TIMEOUT_MS) {
        setAwaiting(null);
        setNotice(
          `The ${awaiting.kind === 'silence' ? 'dwell' : 'restore'} alarm hasn’t fired within ${CONFIRM_TIMEOUT_MS / 1000}s — the OS is deferring it. Grant the battery-optimisation exemption (checklist below) so alarms fire on time; in production a geofence event wakes the device first, so this lag doesn’t happen.`,
        );
        refresh();
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(id);
  }, [awaiting, refresh]);

  // Mirror *real* geofence-driven auto-silent (e.g. a pinned zone) live, not just
  // the manual Enter/Exit buttons: while no manual test is mid-flight, poll native
  // for the current state and its dwell/exit grace countdown so the panel shows
  // the timer + status for a silence the background geofencing task drove. Paused
  // during a manual test so the two countdowns never fight over the display.
  useEffect(() => {
    const clearLive = () => {
      setLivePending(null);
      setLiveApplying(null);
      setLiveNotice(null);
      liveApplyingSinceRef.current = null;
    };
    const id = setInterval(() => {
      // A manual test owns the display via `countdown`/`awaiting`; clear the
      // native mirror so the two never show at once.
      if (countdown || awaiting) {
        clearLive();
        return;
      }
      refresh();
      const pending = RingerControl.getPendingCountdown();
      if (!pending) {
        clearLive();
        return;
      }
      if (pending.remainingMs > 0) {
        // Grace still counting down — show the timer.
        setLivePending({
          kind: pending.kind,
          remainingSec: Math.ceil(pending.remainingMs / 1000),
        });
        setLiveApplying(null);
        setLiveNotice(null);
        liveApplyingSinceRef.current = null;
        return;
      }
      // Grace elapsed but native still reports it pending: the commit alarm
      // hasn't fired yet (the OS can defer it without a battery exemption), so
      // we're mid-apply. Show "applying…" and, past the timeout, explain the lag.
      const since = liveApplyingSinceRef.current ?? Date.now();
      liveApplyingSinceRef.current = since;
      setLivePending(null);
      setLiveApplying({ kind: pending.kind, since });
      setNow(Date.now());
      if (Date.now() - since > CONFIRM_TIMEOUT_MS) {
        setLiveNotice(
          `The ${pending.kind === 'dwell' ? 'dwell' : 'restore'} alarm hasn’t fired within ${CONFIRM_TIMEOUT_MS / 1000}s — the OS is deferring it. Grant the battery-optimisation exemption (checklist below) so alarms fire on time; in production a geofence event wakes the device first, so this lag doesn’t happen.`,
        );
      }
    }, 1000);
    return () => clearInterval(id);
  }, [countdown, awaiting, refresh]);

  const applyMode = useCallback((mode: RingerMode) => {
    // Changing the ringer needs Do Not Disturb access; rather than fail with a
    // raw exception, explain it and offer to open the settings (the production
    // path for this is the permissions checklist, F-01.6).
    if (!RingerControl.isDndAccessGranted()) {
      setDndPromptVisible(true);
      return;
    }
    try {
      RingerControl.setRingerMode(mode);
      setRingerModeState(RingerControl.getRingerMode());
    } catch {
      Alert.alert('Couldn’t change the ringer', 'Please try again.');
    }
  }, []);

  const enterZone = useCallback(() => {
    setNotice(null);
    // Re-enter during the exit buffer is a jitter bounce: cancel the pending
    // restore so the zone stays active and silent. Don't reset here — exercising
    // the bounce is the whole point of pressing Enter mid-buffer.
    if (countdown?.kind === 'exit') {
      setActiveZones(RingerControl.onZoneEnter(TEST_ZONE));
      setCountdown(null);
      return;
    }
    // Otherwise treat Enter as a fresh simulated entry: clear any prior/stuck
    // session first so the dwell always runs. Without this, entering a zone
    // that's already active no-ops natively and shows no countdown — the
    // "Enter zone shows no timer" bug once a previous dwell has committed.
    RingerControl.resetAutoSilent();
    RingerControl.onZoneEnter(TEST_ZONE);
    setActiveZones(RingerControl.activeZoneCount());
    setRingerModeState(RingerControl.getRingerMode());
    setAwaiting(null);
    setCountdown({ kind: 'dwell', endsAt: Date.now() + DWELL_MS });
  }, [countdown]);

  const resetZones = useCallback(() => {
    RingerControl.resetAutoSilent();
    setCountdown(null);
    setAwaiting(null);
    setNotice(null);
    refresh();
  }, [refresh]);

  const exitZone = useCallback(() => {
    setNotice(null);
    setAwaiting(null);
    const count = RingerControl.onZoneExit(TEST_ZONE);
    setActiveZones(count);
    setCountdown((cur) => {
      // Exit during the dwell is a drive-past: native cancels the pending
      // silence, so drop the countdown entirely.
      if (cur?.kind === 'dwell') return null;
      // Leaving a zone we were silencing for: start the exit-buffer countdown.
      if (count > 0) return { kind: 'exit', endsAt: Date.now() + EXIT_BUFFER_MS };
      return null;
    });
  }, []);

  // --- Prayer-aware ("tighten around prayer") gate testing (F-01.10) ----------
  // Push a synthetic prayer window straight to native, bypassing prayer-time
  // computation, so the gate can be exercised on demand. `setPrayerWindows` /
  // `setPrayerAware` re-evaluate any active session immediately (onGateChanged),
  // so with a zone active you see the ringer flip the moment you tap. Fake a
  // window covering *now* → the gate opens and (in a zone) it silences.
  const fakePrayerTimeNow = useCallback(() => {
    const now = Date.now();
    RingerControl.setPrayerAware(true);
    RingerControl.setPrayerWindows([now - 5 * 60_000], [now + 30 * 60_000]);
    setPrayerGate('open');
    refresh();
  }, [refresh]);

  // Gate on, but no window covers now → the gate closes, so in a zone the ringer
  // is restored even though you haven't left (the "prayer window gap").
  const fakeNonPrayerTime = useCallback(() => {
    RingerControl.setPrayerAware(true);
    RingerControl.setPrayerWindows([], []);
    setPrayerGate('closed');
    refresh();
  }, [refresh]);

  // Turn the gate off entirely — back to plain presence-only silencing. Also the
  // way to undo a test so a real zone isn't left gated-off for the session.
  const clearPrayerGate = useCallback(() => {
    RingerControl.setPrayerAware(false);
    RingerControl.setPrayerWindows([], []);
    setPrayerGate('off');
    refresh();
  }, [refresh]);

  // Fire a real prayer reminder ~2s out so a tester can see the notification
  // without waiting for an actual prayer time (the reminders can't otherwise be
  // exercised on demand). Mirrors the zone Enter/Exit buttons' "drive the real
  // path manually" idea, for the prayer-notification feature.
  const testPrayerReminder = useCallback(async () => {
    const scheduled = await sendTestPrayerNotification();
    if (!scheduled) {
      Alert.alert(
        'Notifications are off',
        'Enable notifications for Sakina in system settings, then try again.',
      );
      return;
    }
    Alert.alert(
      'Test reminder scheduled',
      'A prayer reminder will fire in ~2 seconds. Background the app now to see the heads-up banner and hear the channel sound.',
    );
  }, []);

  const remainingSec = countdown
    ? Math.ceil(Math.max(0, countdown.endsAt - now) / 1000)
    : 0;

  // The countdown to display and explain: the manual buttons' precise local
  // `countdown` when a test is running, otherwise the native-polled `livePending`
  // for a real geofence-driven grace. Null while we're in the post-grace "applying"
  // phase (`awaiting`/`liveApplying`), where the timer's been replaced by a
  // "applying…" message. Normalised to one shape for the UI + status.
  const displayCountdown: { kind: 'dwell' | 'exit'; remainingSec: number } | null =
    countdown
      ? { kind: countdown.kind, remainingSec }
      : awaiting || liveApplying
        ? null
        : livePending;

  // The post-grace "applying/restoring, waiting on the deferred OS alarm" phase,
  // unified across the manual (`awaiting`) and real geofence (`liveApplying`)
  // paths so the display + status treat them identically.
  const applying: { kind: 'silence' | 'restore'; sinceSec: number } | null = awaiting
    ? { kind: awaiting.kind, sinceSec: Math.floor((now - awaiting.since) / 1000) }
    : liveApplying
      ? {
          kind: liveApplying.kind === 'dwell' ? 'silence' : 'restore',
          sinceSec: Math.floor((now - liveApplying.since) / 1000),
        }
      : null;

  const status = deriveStatus({
    countdown: displayCountdown,
    applying,
    notice: notice ?? liveNotice,
    activeZones,
    ringerMode,
    silenceMode,
    dndGranted,
    masterEnabled,
  });

  const checks: readonly {
    label: string;
    ok: boolean;
    hint: string;
    critical?: boolean;
  }[] = [
    {
      label: 'Auto-silent master',
      ok: masterEnabled,
      hint: masterEnabled ? 'on' : 'off — turn it on so zones can silence',
    },
    {
      label: 'DND access',
      ok: dndGranted,
      hint: dndGranted ? 'granted' : 'required to switch to silent/vibrate',
      critical: true,
    },
    {
      label: 'Notifications',
      ok: notificationsEnabled,
      hint: notificationsEnabled
        ? 'enabled'
        : 'needed for the foreground service & failure warnings',
    },
    {
      label: 'Battery exemption',
      ok: batteryExempt,
      hint: batteryExempt
        ? 'exempt'
        : 'not exempt — the OS may defer geofence/alarm work',
    },
  ];

  return (
    <>
      <View style={styles.panel}>
        <Text style={styles.heading}>RingerControl (dev)</Text>

        <View style={[styles.status, styles[`status_${status.tone}`]]}>
          <Text style={[styles.statusText, styles[`statusText_${status.tone}`]]}>
            {status.text}
          </Text>
        </View>

        {displayCountdown ? (
          <Text style={styles.countdown}>
            {displayCountdown.kind === 'dwell' ? 'Silencing in' : 'Restoring in'}{' '}
            {displayCountdown.remainingSec}s
          </Text>
        ) : applying ? (
          <Text style={styles.countdown}>
            {applying.kind === 'silence' ? 'Applying silence…' : 'Restoring…'}
          </Text>
        ) : null}

        <Text style={styles.row}>Ringer mode: {ringerMode}</Text>
        <Text style={styles.row}>Silences to: {silenceMode}</Text>
        <Text style={styles.row}>Active zones: {activeZones}</Text>
        <Text style={styles.row}>
          Prayer gate:{' '}
          {prayerGate === 'off'
            ? 'off (presence-only)'
            : prayerGate === 'open'
              ? 'window open — silences in a zone'
              : 'window closed — restores in a zone'}
        </Text>

        <View style={styles.checklist}>
          {checks.map((c) => (
            <View key={c.label} style={styles.checkRow}>
              <View
                style={[
                  styles.dot,
                  {
                    backgroundColor: c.ok
                      ? styles.dotOk.color
                      : c.critical
                        ? styles.dotBad.color
                        : styles.dotWarn.color,
                  },
                ]}
              />
              <Text style={styles.checkLabel}>{c.label}</Text>
              <Text style={styles.checkHint}>{c.hint}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttons}>
          {MODES.map((mode) => (
            <Button key={mode} label={mode} onPress={() => applyMode(mode)} />
          ))}
        </View>

        <View style={styles.buttons}>
          <Button label="Enter zone" onPress={enterZone} />
          <Button label="Exit zone" onPress={exitZone} />
          <Button label="Reset" onPress={resetZones} />
        </View>

        <View style={styles.buttons}>
          <Button label="Prayer time now" onPress={fakePrayerTimeNow} />
          <Button label="Non-prayer time" onPress={fakeNonPrayerTime} />
          <Button label="Prayer gate off" onPress={clearPrayerGate} />
        </View>

        <View style={styles.buttons}>
          <Button
            label="Open DND settings"
            onPress={() => RingerControl.openDndSettings()}
          />
          <Button label="Refresh" onPress={refresh} />
        </View>

        <View style={styles.buttons}>
          <Button
            label="Test prayer reminder"
            onPress={() => void testPrayerReminder()}
          />
        </View>

        <Text style={styles.deviceId}>Device ID: {deviceId}</Text>
      </View>
      <ConfirmDialog
        visible={dndPromptVisible}
        title="Allow Do Not Disturb access"
        message="To switch the ringer to silent or vibrate, Sakina needs Do Not Disturb access. Open settings to grant it?"
        confirmLabel="Open settings"
        cancelLabel="Not now"
        onConfirm={() => {
          setDndPromptVisible(false);
          RingerControl.openDndSettings();
        }}
        onCancel={() => setDndPromptVisible(false)}
      />
    </>
  );
}

/**
 * A panel button with an explicit pressed state — the bare `Pressable`s gave no
 * feedback on tap, so a tester couldn't tell a press registered (the original
 * "Enter zone feels dead" complaint).
 */
function Button({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

/**
 * Translate the raw state machine into one plain-language line, biased toward
 * explaining *why* the phone isn't silenced when a tester expected it to be.
 */
function deriveStatus(s: {
  countdown: { kind: 'dwell' | 'exit'; remainingSec: number } | null;
  applying: { kind: 'silence' | 'restore'; sinceSec: number } | null;
  notice: string | null;
  activeZones: number;
  ringerMode: RingerMode;
  silenceMode: RingerMode;
  dndGranted: boolean;
  masterEnabled: boolean;
}): { tone: StatusTone; text: string } {
  if (s.countdown?.kind === 'dwell') {
    return {
      tone: 'info',
      text: `Dwell grace running — auto-silent applies in ${s.countdown.remainingSec}s if you stay (exit now = drive-past, no silence).`,
    };
  }
  if (s.countdown?.kind === 'exit') {
    return {
      tone: 'info',
      text: `Exit buffer running — ringer restores in ${s.countdown.remainingSec}s (re-enter to cancel the restore).`,
    };
  }
  if (s.applying?.kind === 'silence') {
    return {
      tone: 'info',
      text: `Dwell elapsed — applying silence… waiting for the OS alarm (${s.applying.sinceSec}s). It can lag when battery optimisation isn’t disabled.`,
    };
  }
  if (s.applying?.kind === 'restore') {
    return {
      tone: 'info',
      text: `Exit buffer elapsed — restoring… waiting for the OS alarm (${s.applying.sinceSec}s). It can lag when battery optimisation isn’t disabled.`,
    };
  }
  if (s.notice) {
    return { tone: 'warning', text: s.notice };
  }
  if (s.activeZones > 0) {
    if (s.ringerMode === s.silenceMode) {
      return {
        tone: 'success',
        text: `Silenced (${s.silenceMode}) — inside ${s.activeZones} zone(s).`,
      };
    }
    if (!s.dndGranted) {
      return {
        tone: 'danger',
        text: 'In a zone but NOT silenced: Do Not Disturb access is off, so the ringer can’t be changed. Grant it and re-enter.',
      };
    }
    return {
      tone: 'warning',
      text: `In a zone but ringer is "${s.ringerMode}", not "${s.silenceMode}". Most likely a manual override (your choice is honored until you leave), a prayer-aware window gap, or DND was just lost.`,
    };
  }
  if (!s.masterEnabled) {
    return {
      tone: 'warning',
      text: 'Auto-silent master toggle is OFF — real geofences are disarmed. These buttons still drive the state machine for testing.',
    };
  }
  return {
    tone: 'muted',
    text: 'Idle — not in any zone. Tap "Enter zone" to start the dwell countdown.',
  };
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  panel: {
    alignSelf: 'stretch',
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    gap: 6,
  },
  heading: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
    color: colors.text,
  },
  status: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 2,
  },
  status_success: { backgroundColor: colors.successTint },
  status_warning: { backgroundColor: colors.warningTint },
  status_danger: { backgroundColor: colors.dangerTint },
  status_info: { backgroundColor: colors.surfaceAlt },
  status_muted: { backgroundColor: colors.surfaceAlt },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  statusText_success: { color: colors.success },
  statusText_warning: { color: colors.warning },
  statusText_danger: { color: colors.danger },
  statusText_info: { color: colors.info },
  statusText_muted: { color: colors.textMuted },
  countdown: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  row: {
    fontSize: 13,
    color: colors.textMuted,
  },
  checklist: {
    marginTop: 8,
    gap: 6,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Carriers for the dot palette — referenced as `styles.dotOk.color` etc. so the
  // theme colours stay in one place rather than being read off `colors` inline.
  dotOk: { color: colors.success },
  dotWarn: { color: colors.warning },
  dotBad: { color: colors.danger },
  checkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  checkHint: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.accentBlue,
  },
  buttonPressed: {
    opacity: 0.55,
    transform: [{ scale: 0.97 }],
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.info,
  },
  deviceId: {
    marginTop: 10,
    fontSize: 11,
    color: colors.muted,
  },
});
