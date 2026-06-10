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

## Implementation reminders when EPIC-02 lands

- Replace the dev fixture in `candidates.ts` with the Overpass-proxy fetch +
  on-disk cache (envelope wider than the registration radius).
- Make `armGeofencing()` resilient to fetch failure (keep prior set on error).
- Add the two-threshold (select vs. fetch) split and tile/TTL caching.
- Consider speed-gating re-registration (links F-02.4).
- **Just-in-time fetch around current position on first arm** (no pre-knowledge
  of home/work needed).
- **Dwell-driven prefetch:** cache envelopes around stationary clusters; keep
  inference on-device.
