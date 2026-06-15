/**
 * Tunables for the geofencing trigger (FR-1.2). Centralised so the selection
 * strategy, the re-registration cadence, and the task name are all stated in one
 * place and easy to revisit as field data comes in.
 */

/**
 * TaskManager task name for geofence transitions. Must stay stable across
 * releases — expo-task-manager persists the registration under this key and
 * re-registers it after a reboot, so renaming it would orphan live geofences.
 */
export const GEOFENCING_TASK = 'sakina-geofencing';

/**
 * Hard cap on registered geofences. Android allows ~100 per app; we stay under
 * that to leave headroom for the OS and for transient double-registration during
 * a re-selection.
 */
export const MAX_GEOFENCES = 90;

/**
 * Only mosques within this distance (metres) of the user are considered for the
 * geofence set. Bounds the candidate pool so we register relevant zones, not the
 * nearest 90 mosques on Earth. Pinned zones (EPIC-03) are exempt — they are
 * user-chosen and always included.
 */
export const CANDIDATE_BOUND_RADIUS_M = 25_000;

/**
 * Default geofence radius (metres) for a candidate that doesn't specify its own.
 * A mosque's "near enough to silence" ring; deliberately generous so entry fires
 * before the user is inside the prayer hall.
 */
export const DEFAULT_GEOFENCE_RADIUS_M = 150;

/**
 * Movement threshold (metres) past which the geofence set is re-selected around
 * the user's new position. Coarser than F-02.4's ≥20 m data re-fetch on purpose:
 * re-registering the whole set is comparatively expensive, so we only do it once
 * the user has travelled far enough that the nearest-N selection could meaningfully
 * change.
 */
export const REREGISTER_THRESHOLD_M = 3_000;
