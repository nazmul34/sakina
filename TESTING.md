# Sakina — Manual Test Checklist

A living, on-device QA checklist. Each epic gets a section; tick the boxes as you
verify a build, and update the **Status** line when an epic is completed or its
behaviour changes. Covers **EPIC-0** and **EPIC-1** today (F-01.10 is deferred —
see issue #26). Add new epics as they land.

> Legend: 🟢 done · 🟡 in progress · ⚪ not started · ⏸️ deferred

---

## How to build & install the test APK

```sh
cd mobile
npx expo prebuild -p android --clean   # regenerate android/ with all config plugins
cd android && ./gradlew assembleRelease # debug-signed release APK (bundled JS, runs standalone)
```

- **APK:** `mobile/android/app/build/outputs/apk/release/app-release.apk`
- **Install:** `adb install -r <apk>` (or copy to the phone and tap it).
- **Version:** `versionName` from `app.json` (`expo.version`); `versionCode` auto-derived
  from `git rev-list --count HEAD`. Confirm on-device under Settings → Apps → Sakina.

### ⚠️ Release-build caveat — use the manual zone triggers

Real mosque data (EPIC-02/03) doesn't exist yet, and the synthetic geofence
fixture is `__DEV__`-only — so in a **release** APK, turning Auto-silent ON
registers **zero** geofences and GPS movement cannot trigger silencing.

Use the **Enter zone / Exit zone** buttons in the on-screen *RingerControl (dev)*
panel wherever a step says "Enter/Exit zone". They call the same native
`onZoneEnter`/`onZoneExit` seam the background geofencing task uses, so they drive
the real state machine on demand. _(Added in PR #37.)_

**Timing:** dwell = **45 s** (before silencing) · exit-buffer = **20 s** (before restoring).

### Pre-req: grant all permissions first

Home → **Set up permissions** → grant all four (Location "Allow all the time" +
precise, Notifications, DND access, Battery-optimization exemption) before running
the auto-silent tests. Notifications must be granted or the foreground-service and
warning notifications are suppressed on Android 13+.

---

## EPIC-0 — Foundation

**Status:** 🟢 done

- [ ] **Device ID** — Home shows a Device ID; the dev panel shows the same value;
      it stays identical across app restarts.
- [ ] **Backend registration (F-00.4)** — with the backend reachable at the API
      URL shown on Home, launching the app pings `/health` with an `X-Device-Id`
      header and the server upserts a `Device` row.
- [ ] **Ringer primitives (F-00.2)** — dev panel: with DND granted, tapping
      silent / vibrate / normal changes the phone ringer and updates "Ringer mode"
      (tap **Refresh** to re-read). Without DND granted, tapping **silent** shows an
      error alert (fails loudly).

---

## EPIC-1 — Auto-Silent Near Mosques (flagship)

**Status:** 🟢 done (except F-01.10 ⏸️ deferred — issue #26)

### F-01.1 — Master toggle, persistence, boot re-arm
- [ ] Toggle **Auto-silent ON**, then **OFF** — state holds.
- [ ] Toggle ON → force-stop the app and reopen → toggle is still **ON** (persists).
- [ ] Toggle ON → **reboot device** → monitoring re-arms on its own without opening
      the app (see foreground-service notification returns, F-01.7).

### F-01.2 / F-01.3 — Geofence trigger + capture/restore
- [ ] Grant DND; set ringer **normal**. **Enter zone** → "Active zones: 1"
      immediately, phone **not** yet silent. **Wait 45 s** → phone goes **silent**.
- [ ] **Exit zone** → not restored immediately; **wait 20 s** → ringer **restored**
      to the prior mode (normal).
- [ ] (Real geofences: deferred until mosque data exists — EPIC-02/03.)

### F-01.4 — Dwell + exit-buffer grace
- [ ] **Drive-past:** Enter zone, then Exit zone **within 45 s** → phone **never**
      silences.
- [ ] **Jitter bounce:** Enter → wait 45 s (silent) → Exit (starts 20 s buffer) →
      Enter again **within 20 s** → restore cancelled, stays silent.

### F-01.5 — Honor manual override in-zone
- [ ] Enter zone → wait 45 s (silent). Manually tap **normal** in the panel. Exit
      zone, wait 20 s → ringer is **not** changed back; your choice is honored.

### F-01.6 — Permissions checklist
- [ ] All four rows show live 🟢/🔴 status; **Fix** requests the permission or
      deep-links to the right system screen; status re-checks on returning to the
      screen / app. "✓ All set" banner shows when all four are granted.

### F-01.7 — Foreground service + persistent notification
- [ ] Toggle ON → persistent notification *"Auto-silent is on — Sakina is watching
      for nearby mosques…"* appears (quiet, ongoing).
- [ ] Toggle OFF → notification disappears.
- [ ] Notification requires the **Notifications** permission (Android 13+); if denied,
      the service still runs but the notification is suppressed.

### F-01.8 — Activity log
- [ ] After a full Enter→silence→Exit→restore cycle, Home → **Activity log** shows
      **🔕 Silenced · test-zone** and **🔔 Restored · test-zone** with timestamps,
      grouped by day.
- [ ] Manual-override case (F-01.5) logs a **Silenced** with **no** matching Restored.
- [ ] **Clear log** → confirm → list empties.
- [ ] Retention: log keeps only the most recent 100 events.

### F-01.9 — Failure transparency warnings
- [ ] Revoke **DND access**; ringer normal; **Enter zone**; wait 45 s → silencing
      fails → a **heads-up warning notification** appears; tapping it opens the app.
- [ ] **Throttle:** a second failure right after produces **no** duplicate warning
      (≤ 1 per type per 24 h). Re-grant DND + a successful silence clears the throttle.

### F-01.10 — Prayer-aware silent
- [ ] ⏸️ **Deferred** (issue #26) — depends on EPIC-05 (prayer times) and the open
      decision D-2. Not in this build.

---

## Robustness / negative cases
- [ ] Deny Notifications → foreground service still runs; its notification and
      warning notifications are suppressed (Android 13+).
- [ ] Skip battery-optimization exemption → background reliability degrades on
      aggressive OEMs (relevant once real geofences exist).
