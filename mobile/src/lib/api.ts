/**
 * Thin `fetch` wrapper that is the single chokepoint for backend calls.
 *
 * It attaches the anonymous device identity to every request as the
 * `X-Device-Id` header (F-00.4), so callers never have to think about it.
 * Using a header (rather than the body or query string) keeps the ID out of
 * server access logs and works uniformly for bodiless GET requests.
 */

import { API_BASE_URL } from '../config/env';
import { getDeviceId } from './deviceId';

export const DEVICE_ID_HEADER = 'X-Device-Id';

/** Perform a backend request with the device ID header applied. */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const deviceId = await getDeviceId();

  const url = /^https?:\/\//.test(path)
    ? path
    : `${API_BASE_URL}/${path.replace(/^\//, '')}`;

  const headers = new Headers(init.headers);
  headers.set(DEVICE_ID_HEADER, deviceId);

  return fetch(url, { ...init, headers });
}
