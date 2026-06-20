/**
 * Thin client for the pins CRUD API (F-03.2): `GET/POST/PUT/DELETE /pins`.
 *
 * Wraps {@link ./api}.apiFetch (which attaches the device identity), translating
 * between the local {@link Pin} shape (camelCase, epoch-ms clocks) and the
 * server's wire shape (snake_case, ISO-8601 `updated_at`). The reconciliation
 * logic lives in {@link ./pinsSync}; this module is only transport + mapping.
 */

import { apiFetch } from './api';
import type { Pin } from './pins';

/** A pin as it travels over the wire (matches the Django serializer). */
export interface ServerPin {
  readonly id: string;
  readonly label: string;
  readonly lat: number;
  readonly lng: number;
  readonly radius_m: number;
  /** ISO-8601; the last-write-wins clock. */
  readonly updated_at: string;
  readonly is_deleted: boolean;
}

function toBody(pin: Pin) {
  return {
    id: pin.id,
    label: pin.label,
    lat: pin.latitude,
    lng: pin.longitude,
    radius_m: pin.radiusM,
    updated_at: new Date(pin.updatedAt).toISOString(),
  };
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`pins API ${response.status}`);
  }
  return response;
}

/** Fetch the device's pins, including server tombstones (`is_deleted`). */
export async function listServerPins(): Promise<ServerPin[]> {
  const response = await expectOk(await apiFetch('/pins'));
  const body = (await response.json()) as { pins: ServerPin[] };
  return body.pins;
}

/**
 * Upsert a live pin (idempotent on the server by `id` + last-write-wins). Returns
 * the server's resulting state, which may be newer than what we sent.
 */
export async function upsertServerPin(pin: Pin): Promise<ServerPin> {
  const response = await expectOk(
    await apiFetch('/pins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toBody(pin)),
    }),
  );
  return (await response.json()) as ServerPin;
}

/** Push a local deletion as a server soft-delete (idempotent). */
export async function deleteServerPin(id: string): Promise<void> {
  await expectOk(await apiFetch(`/pins/${id}`, { method: 'DELETE' }));
}
