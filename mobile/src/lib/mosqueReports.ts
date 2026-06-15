/**
 * "Report incorrect mosque" submission seam (FR-2.6).
 *
 * The entry point for crowdsourced corrections: when a user flags a mosque as
 * wrong (closed, misnamed, or not actually a mosque), this is where that report
 * goes. The real backend — a moderated `MosqueReport`/`MosqueSubmission` table,
 * reviewed before it ever affects live data — is **EPIC-08** and isn't built
 * yet, so for Phase 1 this is a deliberate stub: it lets the affordance and its
 * UX ship now behind a stable function the EPIC-08 work can fill in without the
 * screen changing.
 *
 * Reports must never directly mutate mosque data — that data is provider-owned
 * (Geoapify/OSM) and refreshed on a TTL, so corrections live separately and are
 * reconciled later (see EPIC-08 / the #47 tile-invalidation hook).
 */

import type { NearbyMosque } from './mosques';

/**
 * Record that a mosque looks incorrect. Resolves once the report is accepted
 * locally; today that's a no-op log, so it never fails the UX.
 *
 * TODO(EPIC-08): POST this to the crowdsourced report endpoint and surface real
 * submit/failure states to the caller.
 */
export async function submitMosqueReport(mosque: NearbyMosque): Promise<void> {
  console.info('[mosque-report] reported incorrect:', mosque.id);
}
