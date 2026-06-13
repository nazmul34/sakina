package expo.modules.ringercontrol

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Device-local activity log for auto-silent (FR-1.8): a capped, append-only trail
 * of silence / restore events so the user can confirm the feature is working and
 * trust it.
 *
 * Persisted in SharedPreferences as a JSON-array string — the same device-local
 * pattern as the rest of this module — because the events are produced by
 * [RingerSilenceController] in the background, often in a headless launch after an
 * app-kill, where no JS runtime exists to record them. The JS Activity screen
 * reads it back through [RingerControlModule].
 *
 * Each entry carries the event type, the geofence region id of the zone involved
 * (a human-readable mosque/pin name replaces the raw id once EPIC-02/03 supply
 * one), and a wall-clock timestamp. Retention is the most recent [MAX_ENTRIES]
 * events — FR-1.8 requires a cap to bound growth — with older entries dropped on
 * append. Read newest-first, the order the UI wants.
 *
 * Writes happen only from inside [RingerSilenceController]'s lock and reads only
 * from the JS thread, both on the single app process, so the read-modify-write
 * here never races.
 */
internal class ActivityLogStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  /** Append an [event] for [zoneId], trimming to the most recent [MAX_ENTRIES]. */
  fun append(event: String, zoneId: String) {
    val log = read()
    log.put(
      JSONObject()
        .put(KEY_EVENT, event)
        .put(KEY_ZONE, zoneId)
        .put(KEY_AT, System.currentTimeMillis()),
    )

    // JSONArray has no range removal, so when over the cap rebuild from the tail.
    val capped =
      if (log.length() > MAX_ENTRIES) {
        JSONArray().apply {
          for (i in (log.length() - MAX_ENTRIES) until log.length()) put(log.get(i))
        }
      } else {
        log
      }
    prefs.edit().putString(KEY_LOG, capped.toString()).apply()
  }

  /** Every entry, newest first, as plain maps for the Expo bridge. */
  fun entries(): List<Map<String, Any?>> {
    val log = read()
    val out = ArrayList<Map<String, Any?>>(log.length())
    for (i in log.length() - 1 downTo 0) {
      val entry = log.getJSONObject(i)
      out.add(
        mapOf(
          KEY_EVENT to entry.getString(KEY_EVENT),
          KEY_ZONE to entry.getString(KEY_ZONE),
          KEY_AT to entry.getLong(KEY_AT),
        ),
      )
    }
    return out
  }

  /** Clear the whole log. */
  fun clear() {
    prefs.edit().remove(KEY_LOG).apply()
  }

  /** Parse the stored array, tolerating a missing or corrupt value as empty. */
  private fun read(): JSONArray =
    prefs.getString(KEY_LOG, null)?.let { runCatching { JSONArray(it) }.getOrNull() }
      ?: JSONArray()

  internal companion object {
    /** Phone entered a zone and was switched to silent (first committed zone). */
    const val EVENT_SILENCED = "silenced"

    /** Phone left the last zone and the prior ringer mode was restored. */
    const val EVENT_RESTORED = "restored"

    private const val PREFS_NAME = "sakina.activity_log"
    private const val KEY_LOG = "events"
    private const val KEY_EVENT = "event"
    private const val KEY_ZONE = "zone"
    private const val KEY_AT = "at"

    /** Retention cap: the activity log keeps only the most recent N events. */
    private const val MAX_ENTRIES = 100
  }
}
