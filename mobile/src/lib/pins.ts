/**
 * On-device store of user-pinned silent zones (FR-3.1, FR-3.2).
 *
 * A pin is a user-chosen location with a label and a per-pin radius that behaves
 * like a mosque for auto-silent (the geofencing wiring lands in F-03.3). Pins are
 * owned by the device and must survive app restarts, so they live in a single
 * JSON blob in AsyncStorage — the same fit as the mosques cache: a small list we
 * read/write whole and never query relationally, where SQLite would be overkill
 * and SecureStore is for secrets.
 *
 * This module is the local source of truth and is offline-first: edits and
 * deletes apply locally with no network, and {@link ./pinsSync} reconciles them
 * with the backend by last-write-wins on `updatedAt`. Deletes are **soft** —
 * tombstoned with `deletedAt` so the removal can be pushed to the server rather
 * than silently dropped — and {@link readPins} hides tombstones from the UI.
 * Reads degrade to an empty list on any corruption/unavailability so a bad blob
 * never bricks the UI.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { DEFAULT_GEOFENCE_RADIUS_M } from './geofencing/constants';
import type { LatLng } from './geofencing/types';

const PINS_KEY = 'sakina.pins';

/** A user-defined silent zone: a labelled location with its own ring radius. */
export interface Pin extends LatLng {
  /** Stable id; doubles as the geofence region id once F-03.3 wires pins in. */
  readonly id: string;
  /** Human label, e.g. "My local masjid". May be empty while being created. */
  readonly label: string;
  /** Ring radius in metres. */
  readonly radiusM: number;
  /** Epoch ms first saved. */
  readonly createdAt: number;
  /** Epoch ms last edited — the clock that drives last-write-wins sync. */
  readonly updatedAt: number;
  /** Epoch ms this pin was deleted, or `null` if live. A tombstone until synced. */
  readonly deletedAt: number | null;
}

/**
 * Default radius for a newly dropped pin. Mirrors the geofence default so a pin
 * silences over the same generous ring a mosque does until the user tunes it.
 */
export const DEFAULT_PIN_RADIUS_M = DEFAULT_GEOFENCE_RADIUS_M;

/**
 * Radius choices offered in the editor. Presets (not a slider) keep the UI
 * dependency-free and the values predictable; F-02.3 deliberately exposes no
 * radius control, so there's no existing slider to be consistent with.
 */
export const PIN_RADIUS_PRESETS_M = [100, 150, 250, 500, 1000] as const;

function isPin(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === 'string' &&
    typeof p.label === 'string' &&
    typeof p.latitude === 'number' &&
    typeof p.longitude === 'number' &&
    typeof p.radiusM === 'number' &&
    typeof p.createdAt === 'number' &&
    typeof p.updatedAt === 'number' &&
    // `deletedAt` was added in F-03.2; tolerate its absence in pins saved by an
    // earlier build (normalised to `null` on read below) so upgrades keep them.
    (p.deletedAt == null || typeof p.deletedAt === 'number')
  );
}

/**
 * Read every stored pin, **including tombstones**, oldest first. This is the
 * sync view; the UI wants {@link readPins}. Empty on absent/corrupt/unavailable
 * store, dropping any single malformed entry rather than failing the whole read.
 */
export async function readAllPins(): Promise<Pin[]> {
  try {
    const raw = await AsyncStorage.getItem(PINS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Drop malformed entries, and normalise a missing `deletedAt` (legacy pins)
    // to `null` so the rest of the code can treat the field as always present.
    return parsed.filter(isPin).map((p) => ({
      id: p.id,
      label: p.label,
      latitude: p.latitude,
      longitude: p.longitude,
      radiusM: p.radiusM,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: (p.deletedAt as number | null | undefined) ?? null,
    })) as Pin[];
  } catch {
    return [];
  }
}

/** Read the live pins (tombstones hidden), oldest first — the list the UI shows. */
export async function readPins(): Promise<Pin[]> {
  return (await readAllPins()).filter((p) => p.deletedAt === null);
}

/**
 * Replace the entire local store. Used by the sync layer to adopt the server's
 * reconciled state; callers writing one pin should use {@link savePin}.
 */
export async function writePins(pins: Pin[]): Promise<void> {
  await AsyncStorage.setItem(PINS_KEY, JSON.stringify(pins));
}

/** Fields a caller supplies when creating or editing a pin. */
export interface PinDraft extends LatLng {
  readonly label: string;
  readonly radiusM: number;
}

/**
 * Create a new pin (no `id`) or update an existing one (matching `id`), and
 * return the live list. Editing preserves `createdAt`, bumps `updatedAt`, and
 * clears any tombstone (an edit revives a pin), so re-saving acts as an undelete.
 */
export async function savePin(draft: PinDraft, id?: string): Promise<Pin[]> {
  const pins = await readAllPins();
  const now = Date.now();

  if (id && pins.some((p) => p.id === id)) {
    const next = pins.map((p) =>
      p.id === id ? { ...p, ...draft, updatedAt: now, deletedAt: null } : p,
    );
    await writePins(next);
    return next.filter((p) => p.deletedAt === null);
  }

  const created: Pin = {
    id: id ?? Crypto.randomUUID(),
    ...draft,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const next = [...pins, created];
  await writePins(next);
  return next.filter((p) => p.deletedAt === null);
}

/**
 * Soft-delete a pin: tombstone it with `deletedAt`/`updatedAt = now` so the
 * removal can be pushed to the server, and return the live list. The tombstone
 * lingers locally until {@link ./pinsSync} confirms the server has it.
 */
export async function deletePin(id: string): Promise<Pin[]> {
  const pins = await readAllPins();
  const now = Date.now();
  const next = pins.map((p) =>
    p.id === id ? { ...p, deletedAt: now, updatedAt: now } : p,
  );
  await writePins(next);
  return next.filter((p) => p.deletedAt === null);
}
