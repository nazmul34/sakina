/**
 * Tests for the pure geofence-selection strategy (FR-1.2) and the
 * already-inside detection that lets a stationary pin silence immediately.
 */

import type { LocationRegion } from 'expo-location';

import {
  CANDIDATE_BOUND_RADIUS_M,
  DEFAULT_GEOFENCE_RADIUS_M,
  MAX_GEOFENCES,
} from './constants';
import { regionsContainingPoint, selectRegions } from './selection';
import type { GeofenceCandidate, LatLng } from './types';

const HERE: LatLng = { latitude: 51.5074, longitude: -0.1278 };

/** A point `meters` north of `from` — handy for placing candidates at a distance. */
function north(from: LatLng, meters: number): LatLng {
  return { latitude: from.latitude + meters / 111_320, longitude: from.longitude };
}

function pin(id: string, at: LatLng, radius?: number): GeofenceCandidate {
  return { id, kind: 'pin', latitude: at.latitude, longitude: at.longitude, radius };
}

function mosque(id: string, at: LatLng): GeofenceCandidate {
  return { id, kind: 'mosque', latitude: at.latitude, longitude: at.longitude };
}

function region(
  id: string | undefined,
  at: LatLng,
  radius?: number,
): LocationRegion {
  return {
    identifier: id,
    latitude: at.latitude,
    longitude: at.longitude,
    radius: radius ?? DEFAULT_GEOFENCE_RADIUS_M,
    notifyOnEnter: true,
    notifyOnExit: true,
  } as LocationRegion;
}

describe('selectRegions', () => {
  it('always includes pins, however far away, and carries their radius', () => {
    const farPin = pin('p1', north(HERE, 100_000), 250); // 100 km away
    const regions = selectRegions([farPin], HERE);
    expect(regions.map((r) => r.identifier)).toEqual(['p1']);
    expect(regions[0].radius).toBe(250);
  });

  it('drops mosques beyond the candidate bound radius', () => {
    const near = mosque('near', north(HERE, 1_000));
    const far = mosque('far', north(HERE, CANDIDATE_BOUND_RADIUS_M + 5_000));
    const ids = selectRegions([near, far], HERE).map((r) => r.identifier);
    expect(ids).toContain('near');
    expect(ids).not.toContain('far');
  });

  it('ranks pins before mosques even when a mosque is nearer', () => {
    const nearMosque = mosque('m', north(HERE, 50));
    const fartherPin = pin('p', north(HERE, 500));
    const ids = selectRegions([nearMosque, fartherPin], HERE).map(
      (r) => r.identifier,
    );
    expect(ids[0]).toBe('p');
  });

  it('defaults the radius when a candidate omits it', () => {
    const [r] = selectRegions([pin('p', HERE)], HERE);
    expect(r.radius).toBe(DEFAULT_GEOFENCE_RADIUS_M);
  });

  it('never registers more than the cap, keeping the nearest pins', () => {
    const pins = Array.from({ length: MAX_GEOFENCES + 10 }, (_, i) =>
      pin(`p${i}`, north(HERE, (i + 1) * 10)),
    );
    const regions = selectRegions(pins, HERE);
    expect(regions).toHaveLength(MAX_GEOFENCES);
    // The nearest pin (p0, 10 m) is kept; the farthest overflow pin is dropped.
    const ids = regions.map((r) => r.identifier);
    expect(ids).toContain('p0');
    expect(ids).not.toContain(`p${MAX_GEOFENCES + 9}`);
  });
});

describe('regionsContainingPoint', () => {
  it('returns a zone whose ring contains the point (dropped where you stand)', () => {
    const r = region('home', HERE, 150);
    expect(regionsContainingPoint([r], HERE)).toEqual(['home']);
  });

  it('excludes a zone the point is outside of', () => {
    const r = region('away', north(HERE, 1_000), 150);
    expect(regionsContainingPoint([r], HERE)).toEqual([]);
  });

  it('treats the radius as inclusive at the boundary', () => {
    const r = region('edge', north(HERE, 150), 150);
    // ~150 m north with a 150 m radius: on/just inside the ring.
    expect(regionsContainingPoint([r], HERE)).toEqual(['edge']);
  });

  it('falls back to the default radius when a region omits one', () => {
    const inside = { ...region('r', north(HERE, 100)), radius: undefined };
    const outside = { ...region('r2', north(HERE, 200)), radius: undefined };
    expect(regionsContainingPoint([inside as LocationRegion], HERE)).toEqual(['r']);
    expect(regionsContainingPoint([outside as LocationRegion], HERE)).toEqual([]);
  });

  it('skips a region with no identifier rather than seeding a nameless enter', () => {
    expect(regionsContainingPoint([region(undefined, HERE, 150)], HERE)).toEqual(
      [],
    );
  });

  it('returns every containing zone when several overlap the point', () => {
    const a = region('a', HERE, 200);
    const b = region('b', north(HERE, 50), 200);
    const c = region('c', north(HERE, 5_000), 200);
    expect(regionsContainingPoint([a, b, c], HERE).sort()).toEqual(['a', 'b']);
  });
});
