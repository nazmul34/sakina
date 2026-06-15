# Sakina — Manual Test Checklist

A living, on-device QA checklist. Each epic gets a section; tick the boxes as you
verify a build, and update the **Status** line when an epic is completed or its
behaviour changes. Covers **EPIC-0**, **EPIC-1**, **EPIC-2**, and **EPIC-3** today
(F-01.10 is deferred — see issue #26). Add new epics as they land.

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
- [ ] Grant DND; set ringer **normal**. **Enter zone** → the zone enters its
      **45 s dwell** (pending, not yet silencing), so "Active zones" stays **0**.
      **Wait 45 s**, tap **Refresh** → "Active zones: 1" and the phone is **silent**.
- [ ] **Exit zone** → not restored immediately; **wait 20 s**, tap **Refresh** →
      ringer **restored** to the prior mode (normal); "Active zones" back to 0.
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
      for nearby mosques…"* appears (quiet, ongoing). **Note:** it may take up to
      ~10 s to appear — expected, because the channel is low-importance and Android
      defers low-importance foreground-service notifications.
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

## EPIC-2 — Nearby Mosque Discovery

**Status:** 🟢 done (pending device QA)

Unlike the auto-silent geofence tests above, the **Nearby mosques** screen uses
**real backend data**, so it works in a release APK — no `__DEV__` fixture or
manual zone triggers needed.

### Pre-reqs (read first)
- **Rebuild the APK.** #53 added a native dependency (AsyncStorage), so a fresh
  `prebuild` + `assembleRelease` is required — an old APK will crash on the
  Nearby screen.
- **Backend reachable.** Confirm the API URL shown on Home responds.
  - Emulator: the default `10.0.2.2:8000` reaches the host's localhost.
  - **Physical device:** set `EXPO_PUBLIC_API_BASE_URL` to the host's **LAN IP**
    (e.g. `http://192.168.x.x:8000`) before building — `10.0.2.2` only works on
    the emulator. Phone and dev machine must be on the same network.
- **Provider key (optional).** With `GEOAPIFY_API_KEY` set, results come from
  Geoapify; **without** it, the keyless Overpass fallback still returns mosques,
  so the screen works either way.
- **Location granted.** At least "While using"; the permissions screen's
  "Allow all the time" + precise is fine. Test somewhere with mosques within 5 km.
- **Simulating movement:** emulator → Extended controls (`…`) → **Location** to
  push coordinates; on a physical device, actually walk ~20 m.

### F-02.1 / F-02.2 — Backend endpoint + provider fallback _(backend-side)_
- [ ] `curl "http://<api>/mosques?lat=23.78&lng=90.41"` returns JSON
      `{count, radius_m, mosques:[{id,name,lat,lng,distance_m}]}`, **sorted nearest
      first**. `id` is an opaque UUID — no `source`/`external_id`/provider leaked.
- [ ] **Fallback:** with `GEOAPIFY_API_KEY` unset/invalid, the same call still
      returns mosques (Overpass). With a valid key, it uses Geoapify. Either way
      the response shape is identical.

### F-02.3 — High-accuracy GPS + fixed radius
- [ ] Home → **Nearby mosques** → the app gets a location fix and lists mosques
      around you.
- [ ] Deny/disable Location → the screen shows **"Location needed"** with a
      **Set up permissions** button (no crash, no empty silence).
- [ ] No radius control appears anywhere — the radius is server-fixed (~5 km).

### F-02.4 — Movement-gated re-fetch
- [ ] **Stationary:** leave the screen open while still → the list does **not**
      keep re-fetching (no repeated flicker/reorder).
- [ ] **Moved ≥20 m:** change location (simulate or walk) → the list re-fetches
      and re-sorts around the new position.
- [ ] **Pull-to-refresh** forces an immediate refresh at any time.

### F-02.5 — Network timeout + cached fallback
- [ ] Open Nearby mosques once **online** (populates the on-device cache).
- [ ] Enable **airplane mode** (or stop the backend) → pull-to-refresh → after the
      **15 s timeout** the list shows the **last cached results** with an amber
      banner: *"Showing saved results from <time> — couldn't refresh."*
- [ ] **No cache + offline** (fresh install, network off) → **"Couldn't load
      mosques"** error with a **Try again** button.

### F-02.6 — Results UI: name, distance, bearing, Navigate
- [ ] Each row shows **name**, **distance** (`120 m` / `1.4 km`), and a **bearing**
      arrow + compass label (e.g. ↗ NE) pointing toward the mosque.
- [ ] List is sorted **nearest first**.
- [ ] Tap **Navigate** → opens the device's default maps app at the mosque's
      coordinates.

### F-02.7 — Data freshness + report incorrect
- [ ] Header shows **"Updated <relative time>"** for fresh results (and the amber
      cached banner instead when stale — see F-02.5).
- [ ] Tap **Report** on a row → confirm dialog → **"Thanks for the report"**
      acknowledgement; **Cancel** dismisses with no change. _(Stub — EPIC-08 wires
      the real submission; nothing is sent yet.)_

### F-02.8 — Tile cache + coverage tracking _(server-side; verify via backend)_
- [ ] **Miss → populate:** first Nearby load in a new area calls the provider once.
      In Django admin, a **`FetchedTile`** row appears for that area and **`Mosque`**
      rows are populated.
- [ ] **Hit → zero calls:** reopen / move within the same ~5 km tile → results come
      back with **no** new provider call (check backend logs; no new `FetchedTile`).
- [ ] **Dedupe:** repeated loads of the same tile do **not** create duplicate
      `Mosque` rows (unique on `source` + `external_id`).
- [ ] **Empty area:** query a location with no mosques → a `FetchedTile` receipt is
      still written and the list is empty; repeating the query does **not** re-hit
      the provider within the TTL.

---

## EPIC-3 — Custom Pinned Locations

> Maps provider **D-5 → OSM tiles (free)**: Leaflet rendered in a WebView
> (`react-native-webview`), no API key/billing. The map needs network to load
> tiles + the Leaflet library (same as any map).

### F-03.1 — Map pin drop + per-pin radius & label
- [ ] Home → **Pinned zones** → empty state explains what a pinned zone is, with
      an **+ Add a pin** button.
- [ ] **Add a pin** → an OSM map opens centred on your current location (a pin is
      dropped at centre). If location is denied, the map still opens at a fallback
      and you can pan/tap.
- [ ] **Tap the map** moves the pin to the tapped spot; **dragging** the pin
      repositions it. The blue radius circle follows the pin.
- [ ] Change the **Radius** preset (100/150/250/500/1000 m) → the circle resizes
      live without reloading the map (zoom/pan preserved).
- [ ] Enter a **Label** (e.g. "My local masjid"), **Save pin** → returns to the
      list showing the pin with its label and radius.
- [ ] **Persistence:** fully close and relaunch the app → Home → Pinned zones →
      the saved pin(s) are still listed.
- [ ] Tap a pin → editor opens seeded with its location, label, and radius; edit
      and **Save changes** → the list reflects the edit.
- [ ] **Delete pin** in the editor → confirm dialog → pin is removed from the list.

### F-03.2 — Pins CRUD API + soft-delete sync
> Backend lives behind `GET/POST/PUT/DELETE /pins`, scoped to the device by the
> `X-Device-Id` header. Sync is offline-first and last-write-wins on `updated_at`.

- [ ] **Push on save:** add/edit a pin → in Django admin (or
      `GET /pins` with the device's header) the pin appears with matching
      label/lat/lng/radius. Sync fires on app foreground and on opening Pinned zones.
- [ ] **Delete propagates (soft):** delete a pin → server row is **not** removed
      but flips `is_deleted = true` (a tombstone); the app's list no longer shows it.
- [ ] **Offline-first:** turn the backend off (or airplane mode), add/edit/delete
      pins → the UI updates instantly with no error. Restore connectivity, reopen
      Pinned zones → local changes are pushed and the server reflects them.
- [ ] **Last-write-wins:** with a pin already on the server, `PUT /pins/{id}` with
      an **older** `updated_at` is ignored (server state wins, echoed back); a
      **newer** one applies. A newer edit to a deleted pin **resurrects** it.
- [ ] **Restore on reinstall:** with pins synced, clear app data / reinstall →
      relaunch → Pinned zones repopulates from the server (live pins only; tombstones
      stay hidden).
- [ ] **Upgrade keeps old pins:** pins saved by the F-03.1 build (no `deletedAt`)
      survive the first F-03.2 sync rather than being dropped.

---

## Robustness / negative cases
- [ ] Deny Notifications → foreground service still runs; its notification and
      warning notifications are suppressed (Android 13+).
- [ ] Skip battery-optimization exemption → background reliability degrades on
      aggressive OEMs (relevant once real geofences exist).
- [ ] Nearby mosques with the backend **down from the very first launch** (no
      cache yet) → clean error state, never a crash or infinite spinner.
