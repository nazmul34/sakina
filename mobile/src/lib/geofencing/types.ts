/**
 * Shared shapes for the geofencing layer (FR-1.2).
 */

/** What a geofence candidate represents. Pins are user-chosen and prioritised. */
export type GeofenceKind = 'mosque' | 'pin';

/** A latitude/longitude pair, the common currency of this module. */
export interface LatLng {
  readonly latitude: number;
  readonly longitude: number;
}

/**
 * A place that may become an active geofence. Sourced later from nearby mosques
 * (EPIC-02) and pinned zones (EPIC-03); see {@link getGeofenceCandidates}.
 *
 * `id` must be stable across re-selections — it becomes the geofence region
 * identifier, which is what enter/exit events carry and what the ringer state
 * machine reference-counts (F-01.3).
 */
export interface GeofenceCandidate extends LatLng {
  readonly id: string;
  readonly kind: GeofenceKind;
  /** Override ring radius in metres; defaults to DEFAULT_GEOFENCE_RADIUS_M. */
  readonly radius?: number;
}
