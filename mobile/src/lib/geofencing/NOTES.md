# Geofencing — design notes & open questions

Running log of design Q&A for the auto-silent geofencing layer (F-01.2 / EPIC-02).
Captured so we don't re-derive or forget these during later implementation.

> Status legend: ✅ handled now · 🟡 designed, not built · 🔴 open / needs work

---

## Q1. How does this scale? I'm not registering every mosque in the country.

Correct — you never do. Android caps at ~100 active geofences per app, and
downloading a national dataset would be wasteful. The model is a **moving window
around the user**, not a national DB.

- ✅ Register only the **nearest ~90** candidates (`MAX_GEOFENCES`) within a
  bounded radius (`CANDIDATE_BOUND_RADIUS_M = 25 km`) — see `selection.ts`.
- ✅ Re-select around the user's new position once they move past
  `REREGISTER_THRESHOLD_M` (3 km) — `refreshGeofencesForLocation()`.
- 🟡 Candidate data comes from a **local slice** fetched around the user, not the
  country (`getGeofenceCandidates()` seam → EPIC-02).

## Q2. Won't fetching a large amount of mosque data be costly on a paid service?

That's why the PRD specifies **Overpass proxy + cache**, not a paid per-call API.

- 🟡 Mosque locations come from **OpenStreetMap via Overpass** (free):
  `amenity=place_of_worship`, `religion=muslim`, queried over a small bbox.
- 🟡 The **Django backend proxies + caches** results, so many users in one area
  share a single upstream query (collapses cost, dodges rate limits).
- 🟡 Queries are small and infrequent (a few per journey), not a stream.

---

## Q3. User crosses the 3 km threshold with **no internet** → can't fetch → phone won't silence. How do we solve it, at least partially?

🔴 **Open — must address in EPIC-02.** Direction:

- **Persist the candidate set on disk** and fall back to it when offline. Treat
  fetched mosque/pin data as a durable cache, not ephemeral.
- **Never tear down working geofences on a failed refresh.** Current
  `armGeofencing()` only re-registers on a *successful* fetch; make sure a
  network failure keeps the existing set live rather than disarming.
- **Cache a wider envelope than we register** (e.g. fetch ~50 km of mosque data,
  register only the nearest 90). Moving *within* the envelope re-selects from the
  local cache with **zero network**.
- **Pins (EPIC-03) are local-only**, so they always silence offline.
- Limit: genuinely **new, never-visited** areas while offline can't be covered.
  Acceptable degradation — we cover everywhere recently travelled.

## Q4. On a long bus trip, is it worth calling the API every 3 km? How do we solve the churn?

🔴 **Open — must address in EPIC-02 / F-02.4.** Direction:

- **Decouple re-registration from re-fetch (two thresholds):**
  - re-*select* geofences from the **local cache** at the small threshold (~3 km)
    — cheap, no network;
  - re-*fetch* from the **API only at the cache-envelope boundary** (~30–50 km).
- **Tile-based cache with a long TTL.** Mosque locations rarely change, so cache
  per map tile and reuse across the whole journey and across users (backend
  cache). Re-fetch a tile only when its TTL expires or you enter an uncached tile.
- **Motion / speed awareness.** At highway speed the user won't stop at a mosque,
  so back off thresholds or **suspend geofencing while moving fast**, resuming
  when they slow/stop (activity recognition: still vs. in-vehicle).
- Net effect: a cross-country bus ride becomes a handful of tile fetches, not one
  every 3 km.

## Q5. Where do we pull the ~50 km envelope? A new/travelling user's current spot isn't their "home." Caching around home/work would be better — but how do we know those without asking (bad UX)?

🔴 **Open — must address in EPIC-02.** Key reframe: **don't classify home/work and
don't ask — learn where the user *dwells*; the important places emerge.**

- **The envelope is an optimization, not a prerequisite.** On first arm, do a
  **just-in-time fetch of the small slice around the current position** (online,
  fast). That covers a travelling/new user's immediate area instantly. Prefetch
  only makes *future* moves work offline.
- **Learn significant places from dwell, not labels.** Detect a **dwell**
  (stationary > N min, via OS significant-location / Fused Location + activity
  recognition — event-driven, cheap). On a dwell, cache + persist the envelope
  around that point. **Home and work emerge automatically** as the highest-dwell
  places; we never identify them explicitly.
- **Cache accretes by living (tile-on-visit).** Combined with Q4's tile cache,
  the union of visited tiles naturally covers home + work + commute over a few
  days. "Which 50 km?" dissolves — we cache around real movement.
- **Optional refinements:** prioritise prefetch around the densest dwell clusters;
  label via time-of-day only if prioritisation is ever needed (overnight ≈ home,
  weekday-daytime ≈ work) — heuristic, no prompt.
- **Event-driven prefetch:** register one large geofence at the cached-envelope
  boundary; crossing it is the trigger to prefetch the new area (no polling).
- 🔒 **Privacy:** keep all dwell/cluster inference **on-device**. Backend only
  ever sees anonymous tile fetches, never inferred home/work.

---

## Q6. Grace / hysteresis: how do we stop GPS jitter and drive-bys from false-triggering? (F-01.4)

✅ **Handled now**, natively in `ringer-control` (`RingerHysteresis.kt` +
`RingerSilenceController.kt`). Raw geofence enter/exit events are noisy, so we
defer both sides of the transition:

- **Dwell — `DWELL_MS = 45 s`.** An *enter* starts a timer; we silence only if
  the user is still inside when it fires. A drive-past exits first and never
  silences. 45 s sits mid-range of the FR-1.4 30–60 s window: long enough to
  reject a pass-by (crossing a 150 m-radius zone's ~300 m diameter takes <30 s
  above ~25 km/h) without making a real visitor wait a full minute.
- **Exit buffer — `EXIT_BUFFER_MS = 20 s`.** An *exit* starts a timer; we restore
  only if the user hasn't re-entered when it fires. A jitter bounce re-enters
  within the window and cancels the restore, so the ringer doesn't flap. 20 s
  comfortably covers a momentary bounce while restoring only trivially late for
  someone genuinely leaving.

**Fixed for v1, not configurable** (per the issue's recommendation) — revisit
with field data. Values live in `RingerHysteresis` (the native owner); change
them there.

**Why native + AlarmManager, not a JS `setTimeout`:** a geofence transition runs
a *headless* JS task that finishes (and the process may be killed) long before a
45 s dwell elapses, so a JS timer would never fire. AlarmManager wakes the app —
even from a killed process — to deliver to `RingerTimerReceiver`. We use
`setAndAllowWhileIdle` (fires through Doze, no `SCHEDULE_EXACT_ALARM` permission);
the device was just woken by the transition, so the short delays land close to on
time. AlarmManager alarms don't survive a **reboot**, so `RingerBootReceiver`
reconciles any zone caught mid-grace at boot (drop pending silences; complete
pending restores so the phone is never stranded on silent).

---

## Q7. Manual override: if the user changes the ringer while in a zone, how do we honor it without fighting them — and how do we tell their change from our own? (F-01.5)

✅ **Handled now**, natively in `RingerSilenceController` (`lastSetMode` +
`overridden` in `RingerSnapshotStore`).

**Telling our change from theirs (the feedback-loop problem).** The app sets the
ringer itself, so we can't just react to "the ringer changed." We record the mode
we leave the device in (`lastSetMode`, read back after each of our writes so a
failed silence is reflected too). A user-initiated change is then simply: the live
ringer mode differs from `lastSetMode`. Once detected we set `overridden` and go
hands-off for the rest of the session — no re-silence, and on exit we leave the
ringer exactly as the user set it instead of restoring. The flag clears when the
session ends (last committed exit), so normal capture/restore resumes next entry.

In practice we never re-silence mid-session anyway (silencing only fires on the
*first* committed zone; overlapping zones don't re-touch the ringer), so the
concrete behavior change is **skipping the restore-on-exit when the user has taken
over** — plus recording the override so any future re-silence path respects it.

**Why event-boundary comparison, not a live `RINGER_MODE_CHANGED` receiver.** The
issue floated a broadcast receiver. Two problems make it the wrong primitive here:

1. `AudioManager.RINGER_MODE_CHANGED_ACTION` is an *implicit* broadcast, and
   manifest-declared receivers stopped getting those on **API 26+** (it's not on
   the exemption list). So it can only be a **runtime** `registerReceiver`.
2. A runtime receiver needs a **living process**. In the background our process is
   usually dead between geofence events; until the F-01.7 foreground service
   exists there's nothing to host it, so it would only fire while the app is
   foregrounded — exactly when it matters least.

Comparing `lastSetMode` to the live mode at each geofence event (enter / exit /
dwell-commit / buffer-commit) needs no live process and works across app-kill and
reboot, so it's strictly more reliable for the background case. If a live foreground
service lands (F-01.7), a runtime receiver could be added on top for *real-time*
detection, but it isn't required for correctness.

---

## Status: pins are wired (F-03.3 ✅)

`candidates.ts` now feeds **live user pins** (from the on-device pin store) into
the same candidate list as mosques; `selection.ts` already ranks pins first and
caps the combined set at `MAX_GEOFENCES`, so pinned zones silence/restore exactly
like mosque zones and always work offline. Saving/editing/deleting a pin re-arms
the set (best-effort) from `PinEditorScreen`. The mosque side is still the dev
fixture below until EPIC-02 lands.

## Implementation reminders when EPIC-02 lands

- Replace the dev **mosque** fixture in `candidates.ts` (`getMosqueCandidates`)
  with the Overpass-proxy fetch + on-disk cache (envelope wider than the
  registration radius). Pins already flow through `getPinCandidates`.
- Make `armGeofencing()` resilient to fetch failure (keep prior set on error).
- Add the two-threshold (select vs. fetch) split and tile/TTL caching.
- Consider speed-gating re-registration (links F-02.4).
- **Just-in-time fetch around current position on first arm** (no pre-knowledge
  of home/work needed).
- **Dwell-driven prefetch:** cache envelopes around stationary clusters; keep
  inference on-device.

---

## Prayer-aware silent (F-05.5 ✅ bridge / F-01.10 ✅ native gate)

The prayer-windows bridge is built and **off by default** (D-2: opt-in). Prayer
windows are exposed to the JS auto-silent layer as a pure decision —
`evaluatePrayerAwareSilence(settings, location, config, now)` in
`src/lib/prayerAwareSilent.ts` (used for the screen's "Active now" indicator).

✅ **Native gate (implemented).** Native can't compute prayer times (`adhan` is
JS-only), so JS precomputes a rolling list of window boundaries and pushes them to
native via `RingerControl.setPrayerWindows(starts, ends)` + `setPrayerAware`
(`pushPrayerWindowsToNative`, called on arm and on any toggle). Native stores them
in `PrayerWindowStore` and gates `RingerSilenceController`:

- The single `setSilenced(silent)` is now the only place that touches the ringer;
  `applyDesiredSilence` makes the call iff a zone is active **and**
  `PrayerWindowStore.allowedNow()` (permissive when prayer-aware is off).
- On the first committed zone we capture the snapshot and `applyDesiredSilence`;
  if outside a window we stay un-silenced and a **window-boundary alarm**
  (`RingerHysteresis.scheduleWindowBoundary`, action `ACTION_COMMIT_WINDOW`) fires
  at the next start/end to flip us. `commitWindowBoundary` re-applies + reschedules.
- A new `silencing` flag (in `RingerSnapshotStore`) decouples "currently silent"
  from "in a zone", so a window gap restores without ending the session and the
  next window re-silences. Manual override (FR-1.5) and the snapshot/restore
  safety net are reused unchanged; `reconcileAfterBoot` re-evaluates + reschedules
  the boundary for an active prayer-aware session (gated on `enabled`, so the
  presence-only boot path is unchanged).

OFF path is byte-for-byte the prior presence-only behaviour (gate permissive, no
boundary alarms, one silence on entry / one restore on exit).
