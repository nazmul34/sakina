/**
 * Thin client for the device-settings API (F-07.1): `GET/PUT /devices/{id}/settings`.
 *
 * Wraps {@link ./api}.apiFetch (which attaches the device identity) and builds
 * the `{id}` path from {@link ./deviceId}.getDeviceId — the server requires the
 * path id to match the `X-Device-Id` header. Translates between the server's
 * snake_case wire shape and the camelCase the app uses. Reconciliation lives in
 * {@link ./deviceSettingsSync}; this module is only transport + mapping.
 */

import { apiFetch } from './api';
import { getDeviceId } from './deviceId';

/** Device settings as they travel over the wire (matches the Django serializer). */
export interface ServerDeviceSettings {
  readonly device_id: string;
  readonly auto_silent_enabled: boolean;
  readonly radius_m: number;
  readonly theme: string;
  readonly prayer_method: string;
  readonly asr_method: string;
  /** ISO-8601; the last-write-wins clock. */
  readonly updated_at: string;
}

/** The subset of settings this client currently syncs (the AsyncStorage-backed ones). */
export interface SettingsPatch {
  readonly prayerMethod: string;
  readonly asrMethod: string;
  /** Local sync clock in epoch ms. */
  readonly updatedAt: number;
}

async function settingsPath(): Promise<string> {
  return `/devices/${await getDeviceId()}/settings`;
}

async function expectOk(response: Response): Promise<Response> {
  if (!response.ok) {
    throw new Error(`device-settings API ${response.status}`);
  }
  return response;
}

/** Fetch the device's settings, materialising server defaults on first read. */
export async function getServerSettings(): Promise<ServerDeviceSettings> {
  const response = await expectOk(await apiFetch(await settingsPath()));
  return (await response.json()) as ServerDeviceSettings;
}

/**
 * Upsert the synced settings under last-write-wins. Sends only the fields this
 * client owns (a partial patch, so it never clobbers settings owned elsewhere,
 * e.g. a theme set on another device). Returns the server's reconciled state,
 * which may be newer than what we sent.
 */
export async function putServerSettings(
  patch: SettingsPatch,
): Promise<ServerDeviceSettings> {
  const response = await expectOk(
    await apiFetch(await settingsPath(), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prayer_method: patch.prayerMethod,
        asr_method: patch.asrMethod,
        updated_at: new Date(patch.updatedAt).toISOString(),
      }),
    }),
  );
  return (await response.json()) as ServerDeviceSettings;
}
