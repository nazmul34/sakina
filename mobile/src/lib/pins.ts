/**
 * On-device store of user-pinned silent zones (FR-3.1).
 *
 * A pin is a user-chosen location with a label and a per-pin radius that behaves
 * like a mosque for auto-silent (the geofencing wiring lands in F-03.3). Pins are
 * owned by the device and must survive app restarts, so they live in a single
 * JSON blob in AsyncStorage — the same fit as the mosques cache: a small list we
 * read/write whole and never query relationally, where SQLite would be overkill
 * and SecureStore is for secrets.
 *
 * This module is the local source of truth. F-03.2 layers a CRUD API + soft-delete
 * sync on top; until then "delete" is a hard local removal. Reads degrade to an
 * empty list on any corruption/unavailability so a bad blob never bricks the UI.
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
  /** Epoch ms last edited. */
  readonly updatedAt: number;
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

function isPin(value: unknown): value is Pin {
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
    typeof p.updatedAt === 'number'
  );
}

/** Read all saved pins, oldest first. Empty on absent/corrupt/unavailable store. */
export async function readPins(): Promise<Pin[]> {
  try {
    const raw = await AsyncStorage.getItem(PINS_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    // Drop anything that doesn't match the shape rather than failing the whole
    // read — a single bad entry shouldn't hide every other pin.
    return parsed.filter(isPin);
  } catch {
    return [];
  }
}

async function writePins(pins: Pin[]): Promise<void> {
  await AsyncStorage.setItem(PINS_KEY, JSON.stringify(pins));
}

/** Fields a caller supplies when creating or editing a pin. */
export interface PinDraft extends LatLng {
  readonly label: string;
  readonly radiusM: number;
}

/**
 * Create a new pin (no `id`) or update an existing one (matching `id`), and
 * return the saved list. Editing preserves `createdAt` and bumps `updatedAt`.
 */
export async function savePin(draft: PinDraft, id?: string): Promise<Pin[]> {
  const pins = await readPins();
  const now = Date.now();

  if (id) {
    const next = pins.map((p) =>
      p.id === id ? { ...p, ...draft, updatedAt: now } : p,
    );
    await writePins(next);
    return next;
  }

  const created: Pin = {
    id: Crypto.randomUUID(),
    ...draft,
    createdAt: now,
    updatedAt: now,
  };
  const next = [...pins, created];
  await writePins(next);
  return next;
}

/** Remove a pin by id and return the saved list. */
export async function deletePin(id: string): Promise<Pin[]> {
  const pins = await readPins();
  const next = pins.filter((p) => p.id !== id);
  await writePins(next);
  return next;
}
