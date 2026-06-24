# Sakina — Manual Test Checklist

A living, on-device QA checklist. Each epic gets a section; tick the boxes as you
verify a build, and update the **Status** line when an epic is completed or its
behaviour changes. Covers **EPIC-0** through **EPIC-5**, plus **EPIC-07**
(settings persistence & sync). Add new epics as they land.

> Legend: 🟢 done · 🟡 in progress · ⚪ not started · ⏸️ deferred

---

## Before you start (read this first — plain-English guide)

**Who this is for.** You do **not** need to be a developer to run most of these
tests. Each ☐ box tells you something to do in the app and what you should see.
If it matches, tick the box; if not, write down what happened instead.

**What you need.**
- A **phone (or emulator)** with the Sakina app installed. A developer can hand
  you the app file (an `.apk`) — copy it to the phone and tap it to install, or
  ask them to install it for you. (The *"How to build & install"* section below
  is only for whoever **builds** that file.)
- For most tests the phone should be **online** (Wi‑Fi or mobile data). A few
  tests ask you to turn on **Airplane mode** on purpose, to check the app still
  behaves when offline.
- Some tests (mainly EPIC‑1 auto‑silent) use an on‑screen **dev panel** and
  system permissions — just follow the steps as written.

**Words you'll see (quick glossary).**
- **Ringer · silent / vibrate / normal** — your phone's sound mode.
- **DND** — "Do Not Disturb", the Android setting that silences calls and alerts.
  The app needs permission to change it.
- **Geofence / zone** — an invisible circle on the map around a mosque or a saved
  pin. "Entering a zone" means moving inside that circle.
- **Dwell (45 s)** — after you enter a zone the app waits 45 seconds before
  silencing, so just passing by doesn't trigger it. **Exit‑buffer (20 s)** — after
  you leave, it waits 20 seconds before turning the sound back on.
- **Dev panel** — the *"RingerControl (dev)"* box on the Home screen with test
  buttons (e.g. **Enter zone / Exit zone**) that let you test silencing without
  actually travelling.
- **API URL** — the address of the server the app talks to, shown on the Home
  screen.
- **Share sheet / share menu** — the standard menu Android pops up to send
  something to another app (WhatsApp, Messages, etc.).
- **Chip** — a small rounded button (the message category filters are chips).

**How to tick.** Do the action in each ☐ box, compare with the "you should see"
part, and tick ☐ → ☑ when it matches.

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

**Mosque** geofences still aren't real in a release APK: mosque candidate data
(EPIC-02 wiring) isn't fed in yet, and the synthetic mosque fixture is
`__DEV__`-only — so with **no pins saved**, turning Auto-silent ON registers
**zero** geofences and GPS movement cannot trigger silencing.

**Pins are the exception (F-03.3):** a saved pin **is** registered as a real
geofence even in a release build, so on a physical device you can trigger
silencing by actually walking into a pin's radius. See the F-03.3 steps below.

For a deterministic trigger that doesn't depend on GPS, use the **Enter zone /
Exit zone** buttons in the on-screen *RingerControl (dev)* panel wherever a step
says "Enter/Exit zone". They call the same native `onZoneEnter`/`onZoneExit` seam
the background geofencing task uses (with a fixed `test-zone` id), so they drive
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
- [ ] (Real **pin** geofences work on a physical device now — see F-03.3. Real
      **mosque** geofences are still deferred until EPIC-02 candidate wiring lands.)

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
> Opt-in (default **off**) tightening: near a mosque, silence **only** around each
> prayer (just before jamaat to the end of salah) instead of the whole time you're
> in the zone. The toggle lives on **Home → Prayer times → "Tighten around prayer"**.
> Needs **DND access** granted and works on the **manual zone triggers** (see the
> Release-build caveat above) since live mosque geofences await EPIC-02. Setup
> details and the "Active now" indicator are tested under **F-05.5**.
- [ ] **Off by default:** with the toggle **off**, behaviour is unchanged — entering
      a zone silences for the **whole** presence; leaving restores. (This is the
      EPIC-1 F-01.2/F-01.3 behaviour — confirm it still passes.)
- [ ] **Gated when on (inside a window):** turn the toggle **on**; enter a zone
      while the current time **is** within a prayer window (the screen's *Active
      now* shows the prayer). Wait the 45 s dwell → **phone silences**.
- [ ] **Gated when on (outside a window):** with the toggle on, enter a zone when
      *Active now* shows **"No prayer window"**. Wait past the dwell → **phone is
      NOT silenced**. When the next window's start time arrives → it **silences**;
      at the window's end → it **restores** (while you remain in the zone).
- [ ] **Exit & override still hold:** leaving the zone restores as normal; if you
      change the ringer yourself mid-zone, your choice is honoured (F-01.5).
- [ ] **Graceful fallback:** with the toggle on but **location/prayer times
      unknown**, silencing falls back to plain zone presence (never stuck silent).

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

**Status:** 🟢 done (pending device QA)

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

### F-03.3 — Pinned zones participate in auto-silent
> Pins are fed into the **same** geofence set as mosques and silence/restore
> identically. Unlike mosques, a pin **is** a real geofence in a release APK, so
> this is testable on a physical device. Grant all permissions and **Auto-silent
> ON** first. Timing is the usual dwell **45 s** / exit-buffer **20 s**.

- [ ] **Pin registers as a geofence:** with Auto-silent ON, save a pin **at your
      current location** (small radius, e.g. 100 m). The foreground-service
      notification stays up; the pin is now in the live geofence set.
- [ ] **Enter silences (physical device):** start **outside** a pin's radius with
      ringer **normal**, then walk **into** it → after the **45 s** dwell the phone
      goes **silent** (Activity log shows 🔕 Silenced for the pin's zone id).
- [ ] **Exit restores:** walk back **out** of the radius → after the **20 s**
      buffer the ringer is **restored** (Activity log shows 🔔 Restored).
- [ ] **Re-arm on edit:** with Auto-silent ON, add / edit / delete a pin → the set
      re-registers immediately (no app relaunch needed); a deleted pin no longer
      silences, a newly added one does.
- [ ] **Deterministic fallback:** if you can't move physically, the dev-panel
      **Enter zone / Exit zone** buttons still drive the same state machine (fixed
      `test-zone` id) — use them to verify silence/restore without GPS.
- [ ] **Cap (informational):** mosques + pins are capped at `MAX_GEOFENCES` (90)
      with **pins prioritised first**. Hard to hit by hand; covered by the selection
      logic. No user-visible failure when under the cap.

### F-03.4 — Suggested presets
> Quick-start presets prefill a new pin so common zones don't need typing.

- [ ] **Surfaced when adding:** Pinned zones → **+ Add a pin** → a **Suggested**
      row shows **My local masjid**, **Workplace prayer room**, **Home musallah**.
- [ ] **Prefills label + radius:** tap a preset → the **Label** field fills with the
      preset name and the **Radius** jumps to that preset's value (masjid = 150 m;
      prayer room / musallah = 100 m). The tapped chip shows as selected.
- [ ] **Still adjustable:** after picking a preset you can edit the label, change
      the radius, and move the pin before **Save pin** — nothing is locked.
- [ ] **Editing only, hidden:** open an **existing** pin (tap it in the list) → the
      Suggested row is **not** shown (presets are for new pins only).

---

## EPIC-4 — Daily Islamic Message Sharing

**Status:** 🟢 done (pending device QA)

Everything here is done **inside the app by tapping** — no computer or special
tools needed (except the one optional developer check in F‑04.1). Keep the phone
**online** the first time you open the Daily message screen, because the messages
are downloaded from the internet. After that, **Saved messages** and the
**Daily reminder** keep working offline.

**Where to start:** from the Home screen, tap **Daily message**.

### F-04.1 — Messages come from the server
- [ ] Open **Home → Daily message** while connected to the internet. **You should
      see:** a short Islamic message, and under it where it comes from (e.g.
      *Qur'an 2:201* or *Sahih al-Bukhari 13*). Any real message showing here means
      the server is working.
- [ ] _(Optional — for a developer.)_ Open `http://<API URL>/messages/random` in a
      browser. **You should see:** a small block of text (JSON) with `text`,
      `source_label`, and `category`. Adding `?category=quran` returns only Qur'an
      messages; a made-up value like `?category=foo` returns an error message.

### F-04.2 — Reading messages and filtering by type
- [ ] At the top there's a row of rounded buttons (chips): **All · Qur'an · Hadith
      · Du'a · Reminder**. Tap **Qur'an**. **You should see:** the button turns
      green and the message switches to a Qur'an verse. Try each type.
- [ ] Tap **Next message**. **You should see:** a different message of the same
      type appears. (A small spinner may flash while it loads — that's normal.)
- [ ] **Offline behaviour:** turn on **Airplane mode**, then tap **Next message**.
      **You should see:** a friendly *"Couldn't load a message"* note with a **Try
      again** button — **not** a crash. Turn Airplane mode off, tap **Try again** →
      a message loads.

### F-04.3 — Share a message as text
- [ ] With a message on screen, tap **Share text**. **You should see:** the phone's
      normal share menu slides up, and the text being shared is the **message plus
      its source** (the words, then a new line like "— Qur'an 2:201").
- [ ] Pick any app, or just close the menu — closing it should cause no error.

### F-04.4 — Share a message as a picture (for stories/status)
- [ ] Tap **Share as image**. **You should see:** the button briefly reads
      *"Preparing image…"*, then the share menu opens showing a **green picture
      card** containing the message, its source, and the **Sakina** name at the
      bottom.
- [ ] The card is tall (story-shaped), so it fits a WhatsApp/Instagram status.

### F-04.5 — Save favourite messages (works offline)
- [ ] On a message you like, tap the **heart (♡)** in the **top-right corner of the
      card**. **You should see:** it fills in **red (♥)**.
- [ ] Go **back to Home → Saved messages**. **You should see:** the message you
      hearted is in the list, with its type, text, and source.
- [ ] Each saved item has **Share** (opens the text share menu) and **Remove**. Tap
      **Remove** → that item disappears from the list straight away.
- [ ] **Offline check:** save a message, turn on **Airplane mode**, then open
      **Saved messages**. **You should see:** your saved messages still appear (they
      live on the phone). Fully close and reopen the app while still offline → they
      are still there.
- [ ] With nothing saved, the **Saved messages** screen shows a friendly "no saved
      messages" note.

### F-04.6 — Optional daily reminder notification
> This sends one message as a phone notification at a time you pick. It's set up on
> the phone itself, so no internet is needed once it's scheduled. Be **online when
> you turn it on** so it can grab a real message to show.

- [ ] Open **Home → Daily reminder**. **You should see:** an on/off switch (off to
      start with) and a **Time** (8:00 AM by default).
- [ ] Turn the switch **on**. If the phone asks permission to send notifications,
      tap **Allow**. _(If you tap "Don't allow", the app shows a short note and
      leaves the switch off — that's the expected behaviour.)_
- [ ] Tap the **Time** row → a clock appears → choose a time and tap **OK**. **You
      should see:** the Time row updates to your chosen time.
- [ ] **Check it really fires (quick test):** set the time to about **2 minutes from
      now**, leave the switch on, and lock the phone or leave the app. **You should
      see:** at that time a **Sakina** notification appears showing a message — even
      if the app is closed.
- [ ] Turn the switch **off** → no more daily notification appears (the next day's
      reminder is cancelled).

---

## EPIC-5 — Prayer Times (on-device)

**Status:** 🟢 done (pending device QA)

All prayer times are worked out **on the phone** from your location — no internet
needed once the app has your location. **Keep location permission granted** (the
permissions checklist, F-01.6, covers it). Times use your selected calculation
method; the defaults are **Muslim World League** and **Standard (Shafiʿi)** Asr.

**Where to start:** from the Home screen, tap **Prayer times**.

### F-05.1 — Five daily times, computed offline
- [ ] Open **Home → Prayer times**. Under **TODAY'S TIMES** **you should see:**
      **Fajr, Dhuhr, Asr, Maghrib, Isha** with a clock time next to each.
- [ ] **Offline check:** turn on **Airplane mode**, fully close and reopen the app,
      open **Prayer times** again. **You should see:** the same five times still
      appear (they're computed on the phone, not downloaded).
- [ ] _(Sanity)_ The times look right for your city/date (e.g. Maghrib is around
      sunset).
- [ ] If location was **never granted**, the times area shows a friendly *"Grant
      location…"* hint instead of crashing.

### F-05.2 — Calculation method + Asr selection
- [ ] Under **CALCULATION METHOD**, tap a different method (e.g. **Umm al-Qura** or
      **Karachi**). **You should see:** a green tick on the chosen one and the
      **TODAY'S TIMES** above **update immediately**.
- [ ] Under **ASR CALCULATION**, switch between **Standard (Shafiʿi)** and
      **Hanafi**. **You should see:** the **Asr** time changes (Hanafi is later);
      the others stay the same.
- [ ] **Persists:** fully close and reopen the app → your method and Asr choice are
      still selected.

### F-05.3 — Next-prayer countdown on Home
- [ ] On the **Home** screen **you should see:** a green **"Next prayer"** card
      naming the upcoming prayer, its time, and a live **H:MM:SS** countdown ticking
      down each second.
- [ ] **Roll-over:** when a prayer time passes (or check late at night), the card
      moves to the next prayer; after **Isha** it shows tomorrow's **Fajr** (labelled
      *tomorrow*) — it never shows a negative countdown.
- [ ] With **location off**, the card invites you to enable location rather than
      showing nothing.

### F-05.4 — Per-prayer reminder notifications
> Local notifications at each prayer time — set up on the phone, so they fire
> offline once scheduled. Off by default. Be **online when you first enable** so the
> times are fresh, and grant notification permission when asked.

- [ ] On **Prayer times**, under **REMINDERS**, turn **Prayer reminders** on. If
      asked, **Allow** notifications. _(Tapping "Don't allow" shows a note and leaves
      it off — expected.)_
- [ ] **You should see:** a **Play sound** switch and a switch per prayer (Fajr…Isha),
      all on by default; toggle a couple off to pick which prayers remind you.
- [ ] **Check it fires:** the easiest live check is to set Asr/your method so the
      next prayer is a **couple of minutes away** (or just wait for the next prayer),
      lock the phone, and confirm a **Sakina** notification appears at that time —
      even with the app closed.
- [ ] Turn **Prayer reminders** off → upcoming prayer notifications stop.
- [ ] **Coexists with the daily reminder (F-04.6):** with **both** the daily
      reminder and prayer reminders on, opening the **Daily reminder** screen does
      **not** wipe the prayer reminders (and vice-versa).

### F-05.5 — Prayer-aware silent (feeds the flagship)
> This is the setting that powers **F-01.10** (test the silencing behaviour there).

- [ ] Under **PRAYER-AWARE SILENT**, **"Tighten around prayer"** is **off by
      default**.
- [ ] Turn it **on** (location granted). **You should see:** an **Active now** row
      reading either the current prayer and its end time (if you're within a window)
      or **"No prayer window"**.
- [ ] **Persists:** close/reopen the app → the toggle keeps its state.
- [ ] See **F-01.10** for the actual silence/restore behaviour around windows near a
      zone.

---

## EPIC-7 — Settings Persistence & Sync

**Status:** 🟢 done (pending device QA)

Your settings — app **theme**, prayer **calculation method/Asr**, and the **location
label** in the header — are saved on the phone (so they work offline) and mirrored
to the backend, **keyed by the device ID** (`X-Device-Id` header). Sync is
offline-first and **last-write-wins** on an `updated_at` clock, and runs on app
**launch / foreground** (not on every keystroke).

> Backend check (optional): open **Django admin → Device settings**, or
> `GET /devices/{your-device-id}/settings` with the `X-Device-Id` header, to see
> the synced row. The device ID is shown on the **Home** screen.

### F-07.1 — Settings stored on the backend _(backend-side)_
- [ ] **First read makes defaults:** for a device with no settings yet,
      `GET /devices/{id}/settings` returns a row with sensible defaults
      (auto-silent on, theme `system`, method `MuslimWorldLeague`, Asr `standard`)
      rather than a 404.
- [ ] **Upsert:** `PUT /devices/{id}/settings` with a changed field (e.g.
      `{"theme":"dark"}`) returns the updated row; a follow-up `GET` shows it stuck.
- [ ] **Scoped to the device:** a `GET`/`PUT` where the `{id}` in the path does
      **not** match the `X-Device-Id` header is rejected (**403**) — a device can
      only touch its own settings.

### F-07.2 — Offline-first sync + last-write-wins
- [ ] **Push on change:** change a synced setting (switch **theme**, or the prayer
      **method**) → bring the app to the **foreground** (or relaunch) → the server
      row reflects the new value (admin / `GET`).
- [ ] **Offline-first:** turn the backend off (or airplane mode), change settings →
      the UI updates **instantly** with no error. Restore connectivity, reopen the
      app → the change is pushed and the server catches up.
- [ ] **Last-write-wins:** with a value already on the server, a `PUT` carrying an
      **older** `updated_at` is **ignored** (server state wins and is echoed back); a
      **newer** one applies. An identical/equal clock is a no-op (safe to retry).
- [ ] **Trigger is foreground only:** changing a setting and staying in the app
      doesn't spam the server every keystroke; the push happens on the next
      foreground/launch.

### F-07.3 — Theme: Light / Dark / System
- [ ] From **Home → Appearance**, pick **Dark**. **You should see:** the app chrome
      (screen headers and backgrounds) switch to dark **immediately**. Pick **Light**
      → back to light.
- [ ] Pick **System**. **You should see:** the app follows the **phone's** light/dark
      setting — change the system dark-mode toggle and the app flips to match.
- [ ] **Persists:** fully close and reopen the app → your theme choice is retained
      (no flash back to System).
- [ ] _(Sanity)_ The current effective mode is named on the Appearance screen
      ("…currently light/dark").

### F-07.4 — Location name in the header
- [ ] On **Home**, under the title, **you should see:** a 📍 place name for where you
      are (e.g. **"London, England"**). Keep **location permission granted**.
- [ ] **Offline isn't empty:** with the label showing, turn on **Airplane mode**,
      fully close and reopen the app → the **last** place name still appears (it's
      cached), not a blank header.
- [ ] **No location, no clutter:** with location permission **denied**, the header
      simply shows **nothing** (no empty pin, no crash).
- [ ] _(Privacy note)_ The name is resolved **on-device** (no API key, coordinates
      never leave the phone); the first lookup may need network, later ones use the
      cache.

---

## Robustness / negative cases
- [ ] Deny Notifications → foreground service still runs; its notification and
      warning notifications are suppressed (Android 13+).
- [ ] Skip battery-optimization exemption → background reliability degrades on
      aggressive OEMs (testable now via real pin geofences — F-03.3).
- [ ] Nearby mosques with the backend **down from the very first launch** (no
      cache yet) → clean error state, never a crash or infinite spinner.
