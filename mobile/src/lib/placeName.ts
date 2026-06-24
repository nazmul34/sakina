/**
 * Human-readable place name for the home header (F-07.4 / FR-5.1).
 *
 * Turns the user's coordinates into a short label like "London, England" using
 * Expo's **on-device** reverse geocoder (`Location.reverseGeocodeAsync`, the
 * platform's CoreLocation/Android Geocoder). Decision: on-device, not a web API
 * — it needs no API key (stays free), adds no dependency, and the coordinates
 * never leave the phone. Trade-off: the OS geocoder may need network (always on
 * iOS, often on Android), so the resolved name is cached in AsyncStorage and
 * shown while offline (the "header isn't empty offline" criterion).
 *
 * The fix itself comes from `getLastKnownPositionAsync` — cheap and instant (no
 * GPS spin-up), which is what a passive header wants; the precise one-shot fix
 * stays with the features that need it ({@link ./location}).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

const PLACE_KEY = 'sakina.last_place';

/**
 * Compose a concise "City, Region" label from a reverse-geocode result, with
 * fallbacks for sparse data. Returns `null` when nothing usable is present.
 */
export function formatPlaceName(
  address: Location.LocationGeocodedAddress,
): string | null {
  const primary =
    address.city ??
    address.district ??
    address.subregion ??
    address.region ??
    address.name ??
    address.country;
  if (!primary) {
    return null;
  }
  // Add a region/country qualifier when it adds information (not a duplicate).
  const secondary = address.region ?? address.country;
  if (secondary && secondary !== primary) {
    return `${primary}, ${secondary}`;
  }
  return primary;
}

/** Read the last cached place name, or `null` if none has been stored yet. */
export async function getCachedPlaceName(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PLACE_KEY);
  } catch {
    return null;
  }
}

async function cachePlaceName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PLACE_KEY, name);
  } catch {
    // best-effort
  }
}

/**
 * Resolve the current place name from a cheap last-known fix and cache it.
 * Returns `null` (leaving any cached value in place) when the permission is
 * missing, there's no last-known fix, or the geocoder can't resolve/reach a name
 * — every failure is non-fatal so the header degrades to the cached label.
 */
export async function resolveCurrentPlaceName(): Promise<string | null> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) {
      return null;
    }
    const position = await Location.getLastKnownPositionAsync();
    if (!position) {
      return null;
    }
    const [address] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const name = address ? formatPlaceName(address) : null;
    if (name) {
      await cachePlaceName(name);
    }
    return name;
  } catch {
    return null;
  }
}

/**
 * The place name to show in the header. Renders the cached label immediately
 * (so it's populated offline / before a fix lands) and refreshes it from a fresh
 * last-known fix. `null` until anything is available.
 */
export function usePlaceName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getCachedPlaceName().then((cached) => {
      // Don't overwrite a fresh value that may have already resolved.
      if (active && cached) {
        setName((current) => current ?? cached);
      }
    });
    void resolveCurrentPlaceName().then((fresh) => {
      if (active && fresh) {
        setName(fresh);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  return name;
}
