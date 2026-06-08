/**
 * Anonymous device identity (F-00.4).
 *
 * On first launch we mint a random UUID and persist it in the OS secure store
 * (iOS Keychain / Android Keystore). Every later launch reads it back, so the
 * ID is stable across app restarts. This is JS-owned on purpose: it behaves
 * identically on both platforms and is independent of any native hardware ID
 * (the `ringer-control` module's `getDeviceId()` is a separate debug helper).
 *
 * A new install gets a new ID by design — carrying settings across reinstalls
 * is delivered later via account linking (`linked_user` on the server), not by
 * the device ID itself.
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'sakina.device_id';

// Memoised so repeat reads are synchronous-cheap, and `inFlight` dedupes the
// race where several callers ask before the first resolve has finished.
let cached: string | null = null;
let inFlight: Promise<string> | null = null;

async function resolveDeviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

/** Return this install's stable device ID, generating it on first call. */
export async function getDeviceId(): Promise<string> {
  if (cached) {
    return cached;
  }
  if (!inFlight) {
    inFlight = resolveDeviceId();
  }
  try {
    cached = await inFlight;
    return cached;
  } finally {
    inFlight = null;
  }
}
