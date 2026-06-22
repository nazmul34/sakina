package expo.modules.ringercontrol

import android.content.Context

/**
 * Device-local store for prayer-aware silent (F-01.10), the prayer-window gate on
 * top of the geofence-presence state machine (FR-1.10, consuming EPIC-05's
 * windows via FR-5.5).
 *
 * Native can't compute prayer times — `adhan` is JS-only — so JS precomputes a
 * rolling list of window boundaries and pushes them here as parallel `start`/`end`
 * epoch-millis arrays (see `pushPrayerWindowsToNative` on the JS side). This store
 * holds them plus the opt-in flag, and answers the two questions the state machine
 * asks: "should we be allowed to silence right now?" and "when does that answer
 * next change?".
 *
 * Persisted in SharedPreferences (pattern shared with [RingerSnapshotStore] /
 * [AutoSilentStore]) so the gate survives the app-kill and reboot the background
 * silencing already tolerates. When prayer-aware is **off** the gate is fully
 * permissive ([allowedNow] is always true), so the OFF path is byte-for-byte the
 * presence-only behaviour that shipped before this feature.
 */
internal class PrayerWindowStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** Whether prayer-aware tightening is enabled (the opt-in flag, default off). */
  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

  /**
   * Replace the stored window boundaries. [starts] and [ends] are parallel arrays
   * of epoch millis (start[i]..end[i] is one window), pushed by JS already sorted
   * and future-trimmed. Stored as `;`-joined longs — small (≤ ~35 windows) and
   * SharedPreferences has no list-of-long type.
   */
  fun setWindows(starts: List<Long>, ends: List<Long>) {
    val n = minOf(starts.size, ends.size)
    prefs.edit()
      .putString(KEY_STARTS, starts.take(n).joinToString(SEP))
      .putString(KEY_ENDS, ends.take(n).joinToString(SEP))
      .apply()
  }

  /** The stored windows as (start, end) pairs, in the order JS pushed them. */
  private fun windows(): List<Pair<Long, Long>> {
    val starts = parse(prefs.getString(KEY_STARTS, null))
    val ends = parse(prefs.getString(KEY_ENDS, null))
    val n = minOf(starts.size, ends.size)
    return (0 until n).map { starts[it] to ends[it] }
  }

  /**
   * Whether silencing is permitted at [nowMs]. Permissive (true) when prayer-aware
   * is off, so the presence-only path is unaffected; otherwise true only while
   * [nowMs] falls inside a window.
   */
  fun allowedNow(nowMs: Long): Boolean {
    if (!enabled) return true
    return windows().any { (start, end) -> nowMs in start..end }
  }

  /**
   * The next instant after [nowMs] at which [allowedNow] would change — a window
   * start (silence) or end (restore) — or `null` if none remain. Null means the
   * window list is exhausted; JS re-pushes a fresh rolling list on the next arm,
   * so this just stops scheduling until then.
   */
  fun nextBoundaryAfter(nowMs: Long): Long? {
    if (!enabled) return null
    return windows()
      .flatMap { (start, end) -> listOf(start, end) }
      .filter { it > nowMs }
      .minOrNull()
  }

  private fun parse(raw: String?): List<Long> =
    raw?.takeIf { it.isNotEmpty() }
      ?.split(SEP)
      ?.mapNotNull { it.toLongOrNull() }
      ?: emptyList()

  private companion object {
    const val PREFS_NAME = "sakina.prayer_windows"
    const val KEY_ENABLED = "enabled"
    const val KEY_STARTS = "window_starts"
    const val KEY_ENDS = "window_ends"
    const val SEP = ";"
  }
}
