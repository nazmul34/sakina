/**
 * "Report incorrect mosque" submission (FR-2.6).
 *
 * The entry point for crowdsourced corrections: when a user flags a mosque as
 * wrong (closed, misnamed, or not actually a mosque), this posts the report to
 * the backend's moderated `MosqueReport` table (`POST /mosques/reports`). The
 * report is queued as `pending` and reviewed before it ever affects live data.
 *
 * Reports never directly mutate mosque data — that data is provider-owned
 * (Geoapify/OSM) and refreshed on a TTL, so corrections live separately and are
 * reconciled later (EPIC-08 / the #47 tile-invalidation hook). We send a
 * snapshot of what the user was shown (the opaque id plus name/coords) so the
 * report stays meaningful even after the provider cache refreshes.
 */

import { apiFetch } from './api';
import type { NearbyMosque } from './mosques';

/**
 * Record that a mosque looks incorrect. Resolves once the backend accepts the
 * report (HTTP 201); rejects on a non-2xx response or network failure so the
 * caller can surface a retry (see {@link ../screens/NearbyMosquesScreen}).
 */
export async function submitMosqueReport(mosque: NearbyMosque): Promise<void> {
  const response = await apiFetch('mosques/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mosque_id: mosque.id,
      name: mosque.name,
      lat: mosque.latitude,
      lng: mosque.longitude,
    }),
  });

  if (!response.ok) {
    throw new Error(`Mosque report failed (HTTP ${response.status})`);
  }
}
