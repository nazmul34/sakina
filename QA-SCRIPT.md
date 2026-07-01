# Sakina — QA Test Script

Run these in order. For each step: do the **Action**, then check the **Expected**.
If it matches, mark ✅. If not, write what actually happened.

> Timing constants used below: **dwell = 45 s** (before silencing) · **exit-buffer
> = 20 s** (before restoring). The dev panel is *"RingerControl (dev)"* on Home; its
> **Enter zone / Exit zone** buttons drive the same state machine as real geofences
> (fixed `test-zone` id).

---

## 0. Setup (do this first, once)

| # | Action | Expected |
|---|--------|----------|
| 0.1 | Install the APK and open the app, online. | App launches to the Home screen. |
| 0.2 | Home → **Set up permissions** → grant all four: Location ("Allow all the time" + precise), Notifications, DND access, Battery-optimization exemption. | All four rows show 🟢; **"✓ All set"** banner appears. |
| 0.3 | Note the **API URL** and **Device ID** shown on Home. | Both are visible; Device ID matches the dev panel value. |

---

## 1. Foundation (EPIC-0)

| # | Action | Expected |
|---|--------|----------|
| 1.1 | Read the **Device ID** on Home, then force-stop and reopen the app. | Same Device ID both times. |
| 1.2 | Dev panel → with DND granted, tap **silent**, then **vibrate**, then **normal** (tap **Refresh** after each). | Phone ringer changes each time; "Ringer mode" updates to match. |
| 1.3 | Revoke DND access, dev panel → tap **silent**. | An **error alert** appears (it fails loudly). Re-grant DND after. |

---

## 2. Auto-Silent (EPIC-1)

### 2A. Master toggle
| # | Action | Expected |
|---|--------|----------|
| 2.1 | Toggle **Auto-silent ON**, then **OFF**. | State holds at each tap. |
| 2.2 | Toggle **ON** → force-stop the app → reopen. | Toggle is still **ON**. |
| 2.3 | With it ON, **reboot the device** (don't open the app). | Monitoring re-arms by itself; foreground-service notification reappears. |

### 2B. Silence / restore cycle (use the dev panel)
| # | Action | Expected |
|---|--------|----------|
| 2.4 | Ringer **normal**. Tap **Enter zone**, immediately tap **Refresh**. | "Active zones: **0**" (still in 45 s dwell, not silenced yet). |
| 2.5 | Wait **45 s**, tap **Refresh**. | "Active zones: **1**" and phone is **silent**. |
| 2.6 | Tap **Exit zone**, immediately tap **Refresh**. | Not restored yet (20 s buffer running). |
| 2.7 | Wait **20 s**, tap **Refresh**. | Ringer **restored to normal**; "Active zones: **0**". |

### 2C. Grace windows
| # | Action | Expected |
|---|--------|----------|
| 2.8 | **Drive-past:** Enter zone, then Exit zone **within 45 s**. | Phone **never** silences. |
| 2.9 | **Jitter:** Enter → wait 45 s (silent) → Exit → Enter again **within 20 s**. | Restore is cancelled; stays **silent**. |

### 2D. Manual override
| # | Action | Expected |
|---|--------|----------|
| 2.10 | Enter zone → wait 45 s (silent) → manually tap **normal** → Exit zone → wait 20 s. | Ringer **not** changed back; your manual choice is honored. |

### 2E. Foreground notification
| # | Action | Expected |
|---|--------|----------|
| 2.11 | Toggle Auto-silent **ON**. | Within ~10 s, a quiet ongoing notification *"Auto-silent is on…"* appears. |
| 2.12 | Toggle **OFF**. | Notification disappears. |

### 2F. Activity log
| # | Action | Expected |
|---|--------|----------|
| 2.13 | After a full Enter→silence→Exit→restore cycle, Home → **Activity log**. | Shows **🔕 Silenced · test-zone** and **🔔 Restored · test-zone** with timestamps, grouped by day. |
| 2.14 | After the manual-override case (2.10), check the log. | A **Silenced** with **no** matching Restored. |
| 2.15 | Tap **Clear log** → confirm. | List empties. |

### 2G. Failure warnings
| # | Action | Expected |
|---|--------|----------|
| 2.16 | Revoke **DND access**, ringer normal, **Enter zone**, wait 45 s. | Silencing fails → a **heads-up warning notification** appears; tapping it opens the app. |
| 2.17 | Trigger a second failure right after. | **No** duplicate warning (≤ 1 per type / 24 h). Re-grant DND + a successful silence to clear it. |

---

## 3. Nearby Mosques (EPIC-2)

Uses real backend data — confirm the API URL on Home responds first. Test where there are mosques within 5 km.

| # | Action | Expected |
|---|--------|----------|
| 3.1 | Home → **Nearby mosques**. | App gets a location fix and lists mosques. |
| 3.2 | Inspect a row. | Shows **name**, **distance** (`120 m` / `1.4 km`), and a **bearing arrow + compass label** (e.g. ↗ NE). |
| 3.3 | Check list order. | Sorted **nearest first**. |
| 3.4 | Header. | Shows **"Updated <relative time>"**. |
| 3.5 | Tap **Navigate** on a row. | Opens the device's default maps app at the mosque's coordinates. |
| 3.6 | Stay still with the screen open. | List does **not** keep re-fetching (no flicker/reorder). |
| 3.7 | Move ≥20 m (simulate or walk). | List re-fetches and re-sorts around the new position. |
| 3.8 | **Pull-to-refresh.** | Forces an immediate refresh. |
| 3.9 | Open once online (caches), then enable **airplane mode** → pull-to-refresh. | After the **15 s timeout**, shows last cached results with an amber banner *"Showing saved results from <time>…"*. |
| 3.10 | Deny/disable Location → open the screen. | **"Location needed"** with a **Set up permissions** button (no crash). |
| 3.11 | Tap **Report** on a row → confirm. | **"Thanks for the report"** ack. (Cancel dismisses with no change.) |

---

## 4. Pinned Locations (EPIC-3)

### 4A. Create / edit
| # | Action | Expected |
|---|--------|----------|
| 4.1 | Home → **Pinned zones** (empty). | Empty-state explainer with an **+ Add a pin** button. |
| 4.2 | **+ Add a pin**. | OSM map opens centred on your location with a pin at centre. |
| 4.3 | **Tap** elsewhere on the map; then **drag** the pin. | Pin moves to the tap; drag repositions it; blue radius circle follows. |
| 4.4 | Change the **Radius** preset (100/150/250/500/1000 m). | Circle resizes live; map zoom/pan preserved. |
| 4.5 | Enter a **Label** → **Save pin**. | Returns to list showing the pin with its label and radius. |
| 4.6 | Fully close and relaunch → Pinned zones. | Saved pin(s) still listed. |
| 4.7 | Tap a pin → edit → **Save changes**. | Editor seeded with current values; list reflects the edit. |
| 4.8 | Open a pin → **Delete pin** → confirm. | Pin removed from list. |

### 4B. Presets
| # | Action | Expected |
|---|--------|----------|
| 4.9 | **+ Add a pin** → look for **Suggested** row. | Shows **My local masjid**, **Workplace prayer room**, **Home musallah**. |
| 4.10 | Tap a preset. | Label fills with preset name; radius jumps (masjid 150 m; prayer room / musallah 100 m); chip shows selected. |
| 4.11 | Open an **existing** pin. | Suggested row is **not** shown (new pins only). |

### 4C. Pins drive auto-silent (physical device)
> Auto-silent **ON**, all permissions granted.

| # | Action | Expected |
|---|--------|----------|
| 4.12 | Save a pin at your current location (small radius, e.g. 100 m). | Foreground-service notification stays up; pin is in the live geofence set. |
| 4.13 | Start **outside** the radius (ringer normal) → walk **in** → wait 45 s. | Phone goes **silent**; Activity log shows 🔕 Silenced for the pin's zone. |
| 4.14 | Walk back **out** → wait 20 s. | Ringer **restored**; Activity log shows 🔔 Restored. |
| 4.15 | With Auto-silent ON, add/edit/delete a pin. | Geofence set re-registers immediately (no relaunch). |

---

## 5. Daily Message (EPIC-4)

Be online the first time you open this screen.

| # | Action | Expected |
|---|--------|----------|
| 5.1 | Home → **Daily message** (online). | A short Islamic message + its source (e.g. *Qur'an 2:201*). |
| 5.2 | Tap each chip: **All · Qur'an · Hadith · Du'a · Reminder**. | Selected chip turns green; message switches to that type. |
| 5.3 | Tap **Next message**. | A different message of the same type (brief spinner is normal). |
| 5.4 | **Airplane mode** → **Next message**. | Friendly *"Couldn't load a message"* + **Try again** (no crash). Turn off airplane → **Try again** loads a message. |
| 5.5 | Tap **Share text**. | Share menu opens; shared text is the **message + source** on a new line. |
| 5.6 | Tap **Share as image**. | Brief *"Preparing image…"*, then share menu with a **green story-shaped card** (message, source, Sakina name). |
| 5.7 | Tap the **heart (♡)** top-right of the card. | Fills **red (♥)**. |
| 5.8 | Home → **Saved messages**. | The hearted message is listed with type, text, source; each has **Share** and **Remove**. |
| 5.9 | Tap **Remove** on an item. | It disappears immediately. |
| 5.10 | Save a message → airplane mode → open Saved messages → close/reopen app offline. | Saved messages still appear. |

### 5A. Daily reminder
| # | Action | Expected |
|---|--------|----------|
| 5.11 | Home → **Daily reminder**. | On/off switch (off) + **Time** (8:00 AM default). |
| 5.12 | Turn switch **on** → **Allow** notifications if asked. | Switch stays on. (Denying shows a note and leaves it off.) |
| 5.13 | Tap **Time** → pick ~**2 min from now** → OK → lock the phone. | At that time a **Sakina** notification with a message appears, even with the app closed. |
| 5.14 | Turn the switch **off**. | No further daily notification. |

---

## 6. Prayer Times (EPIC-5)

Location granted. Computed on-device.

| # | Action | Expected |
|---|--------|----------|
| 6.1 | Home → **Prayer times**. | **TODAY'S TIMES** lists **Fajr, Dhuhr, Asr, Maghrib, Isha** with times. |
| 6.2 | **Airplane mode** → close/reopen app → Prayer times. | Same five times still appear. |
| 6.3 | **CALCULATION METHOD** → tap a different method (e.g. Umm al-Qura). | Green tick on chosen one; times above update immediately. |
| 6.4 | **ASR CALCULATION** → switch Standard ↔ Hanafi. | **Asr** time changes (Hanafi later); others unchanged. |
| 6.5 | Close and reopen the app. | Method and Asr choice still selected. |
| 6.6 | Look at **Home**. | Green **"Next prayer"** card: prayer name, time, live **H:MM:SS** countdown ticking down. |
| 6.7 | Check after a prayer time passes (or late at night). | Card rolls to the next prayer; after Isha shows tomorrow's **Fajr** (*tomorrow*); never negative. |

### 6A. Prayer reminders
| # | Action | Expected |
|---|--------|----------|
| 6.8 | Prayer times → **REMINDERS** → turn **Prayer reminders** on → **Allow** if asked. | A **Play sound** switch + a switch per prayer, all on by default. |
| 6.9 | Set method/Asr so the next prayer is ~2 min away → lock the phone. | A **Sakina** notification fires at that time, even with the app closed. |
| 6.10 | Turn **Prayer reminders** off. | Upcoming prayer notifications stop. |
| 6.11 | With both daily reminder (5.11) and prayer reminders on, open the **Daily reminder** screen. | Prayer reminders are **not** wiped (and vice-versa). |

### 6B. Prayer-aware silent toggle
| # | Action | Expected |
|---|--------|----------|
| 6.12 | Prayer times → **PRAYER-AWARE SILENT**. | **"Tighten around prayer"** is **off by default**. |
| 6.13 | Turn it **on** (location granted). | An **Active now** row showing the current prayer + end time, or **"No prayer window"**. |
| 6.14 | Close/reopen the app. | Toggle keeps its state. |

### 6C. Prayer-aware silencing behaviour (F-01.10, uses dev panel)
| # | Action | Expected |
|---|--------|----------|
| 6.15 | Toggle **off** → Enter zone → wait 45 s. | Silences for the whole presence; Exit restores (unchanged EPIC-1 behaviour). |
| 6.16 | Toggle **on**, *Active now* shows a prayer → Enter zone → wait 45 s. | Phone **silences**. |
| 6.17 | Toggle **on**, *Active now* shows **"No prayer window"** → Enter zone → wait past dwell. | **Not** silenced. At the next window's start it **silences**; at its end it **restores** (while still in zone). |

---

## 7. Settings & Theme (EPIC-7)

| # | Action | Expected |
|---|--------|----------|
| 7.1 | Home → **Appearance** → pick **Dark**. | App chrome switches to dark immediately. Pick **Light** → back to light. |
| 7.2 | Pick **System** → change the phone's system dark-mode toggle. | App flips to match the phone. |
| 7.3 | Fully close and reopen the app. | Theme choice retained (no flash back to System). |
| 7.4 | Look at **Home** under the title (location granted). | A 📍 place name (e.g. "London, England"). |
| 7.5 | With the label showing, **airplane mode** → close/reopen app. | The **last** place name still appears (cached), not blank. |
| 7.6 | Deny location permission → reopen Home. | Header shows **nothing** (no empty pin, no crash). |

---

## 8. Negative / robustness

| # | Action | Expected |
|---|--------|----------|
| 8.1 | Deny **Notifications**, run an Enter→silence cycle. | Foreground service still runs; its notification and warning notifications are suppressed (Android 13+). |
| 8.2 | Open Nearby mosques with the **backend down from first launch** (no cache). | Clean error state — never a crash or infinite spinner. |
