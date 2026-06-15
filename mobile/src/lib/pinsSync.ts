/**
 * Offline-first reconciliation of pinned zones with the backend (FR-3.2).
 *
 * The local store ({@link ./pins}) is always writable with no network; this
 * module pushes whatever has accumulated there and then adopts the server's
 * reconciled truth. Conflict resolution is **last-write-wins on `updatedAt`**,
 * enforced server-side — so pushing is safe to repeat: a stale local edit can't
 * clobber a fresher server state, and re-pushing an unchanged pin is a no-op.
 *
 * The flow each sync:
 *   1. push every local pin — soft-deleted ones via DELETE, the rest via POST
 *      (an idempotent upsert);
 *   2. GET the server's now-merged state (including its tombstones);
 *   3. adopt it locally, keeping only live pins (the server retains tombstones,
 *      so we don't need to hoard them on-device).
 *
 * It's best-effort: any network failure aborts before step 3, leaving the local
 * store — and its pending changes — untouched for the next attempt. A single
 * in-flight guard means overlapping triggers (foreground + screen focus) coalesce
 * instead of racing.
 */

import {
  deleteServerPin,
  listServerPins,
  upsertServerPin,
  type ServerPin,
} from './pinsApi';
import { readAllPins, writePins, type Pin } from './pins';

let inFlight: Promise<Pin[]> | null = null;

/**
 * Reconcile local pins with the server and return the resulting live pins.
 * Coalesces concurrent calls into one round-trip. Rejects (leaving local state
 * intact) if the network is unavailable.
 */
export function syncPins(): Promise<Pin[]> {
  if (!inFlight) {
    inFlight = reconcile().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function reconcile(): Promise<Pin[]> {
  const local = await readAllPins();

  // Push local state up. Run sequentially: the set is tiny and this keeps the
  // failure mode simple (first network error aborts before we adopt anything).
  for (const pin of local) {
    if (pin.deletedAt !== null) {
      await deleteServerPin(pin.id);
    } else {
      await upsertServerPin(pin);
    }
  }

  const server = await listServerPins();

  // Preserve each pin's original createdAt across the round-trip (the server
  // doesn't track it); fall back to updatedAt for pins first seen from elsewhere.
  const createdAtById = new Map(local.map((p) => [p.id, p.createdAt]));
  const adopted = server
    .filter((s) => !s.is_deleted)
    .map((s) => toLocalPin(s, createdAtById.get(s.id)));

  await writePins(adopted);
  return adopted;
}

function toLocalPin(server: ServerPin, createdAt?: number): Pin {
  const updatedAt = Date.parse(server.updated_at);
  return {
    id: server.id,
    label: server.label,
    latitude: server.lat,
    longitude: server.lng,
    radiusM: server.radius_m,
    createdAt: createdAt ?? updatedAt,
    updatedAt,
    deletedAt: null,
  };
}

/**
 * Fire-and-forget sync that never rejects — for screen focus / app-foreground
 * triggers where the UI already shows local state and a failed sync should be
 * invisible. Returns the synced pins on success, or `null` if it couldn't reach
 * the server (the caller keeps showing what it has via {@link readPins}).
 */
export async function trySyncPins(): Promise<Pin[] | null> {
  try {
    return await syncPins();
  } catch {
    return null;
  }
}
