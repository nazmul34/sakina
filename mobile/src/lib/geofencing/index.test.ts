/**
 * Orchestration tests for arm/disarm (FR-1.2). The native ringer state machine
 * and Expo location APIs are mocked; the real selection + geo logic runs, so
 * these exercise the actual arming decisions — including the fix that seeds an
 * enter for a zone the user is already standing inside (stationary pins), and the
 * reconcile that releases zones we stop monitoring.
 */

import * as Location from 'expo-location';

import AutoSilent from '../../../modules/auto-silent';
import RingerControl from '../../../modules/ringer-control';
import { getGeofenceCandidates } from './candidates';
import { armGeofencing, disarmGeofencing } from './index';
import type { GeofenceCandidate, LatLng } from './types';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  requestBackgroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  startGeofencingAsync: jest.fn(),
  stopGeofencingAsync: jest.fn(),
  hasStartedGeofencingAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../../../modules/auto-silent', () => ({
  __esModule: true,
  default: { isEnabled: jest.fn() },
}));
jest.mock('../../../modules/ringer-control', () => ({
  __esModule: true,
  default: { onZoneEnter: jest.fn(), reconcileActiveZones: jest.fn() },
}));
jest.mock('../prayerAwareSilent', () => ({
  syncPrayerAwareSilentToNative: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./candidates', () => ({ getGeofenceCandidates: jest.fn() }));
// Side-effect-only import in index.ts; stub it so we don't pull expo-task-manager.
jest.mock('./task', () => ({}));

const HERE: LatLng = { latitude: 51.5074, longitude: -0.1278 };

function north(from: LatLng, meters: number): LatLng {
  return { latitude: from.latitude + meters / 111_320, longitude: from.longitude };
}

function pin(id: string, at: LatLng, radius = 150): GeofenceCandidate {
  return { id, kind: 'pin', latitude: at.latitude, longitude: at.longitude, radius };
}

const location = Location as jest.Mocked<typeof Location>;
const autoSilent = AutoSilent as jest.Mocked<typeof AutoSilent>;
const ringer = RingerControl as jest.Mocked<typeof RingerControl>;
const candidates = getGeofenceCandidates as jest.MockedFunction<
  typeof getGeofenceCandidates
>;

/** Wire up the "everything granted, standing at HERE" happy path. */
function happyPath(): void {
  autoSilent.isEnabled.mockReturnValue(true);
  location.requestForegroundPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  location.requestBackgroundPermissionsAsync.mockResolvedValue({
    granted: true,
  } as never);
  location.getLastKnownPositionAsync.mockResolvedValue({
    coords: HERE,
  } as never);
  location.startGeofencingAsync.mockResolvedValue(undefined as never);
  location.hasStartedGeofencingAsync.mockResolvedValue(true as never);
  location.stopGeofencingAsync.mockResolvedValue(undefined as never);
  candidates.mockResolvedValue([]);
}

beforeEach(() => {
  jest.clearAllMocks();
  happyPath();
});

describe('armGeofencing gating', () => {
  it('does nothing when the master toggle is off', async () => {
    autoSilent.isEnabled.mockReturnValue(false);
    await armGeofencing();
    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(ringer.reconcileActiveZones).not.toHaveBeenCalled();
    expect(ringer.onZoneEnter).not.toHaveBeenCalled();
  });

  it('does not arm without background location permission', async () => {
    location.requestBackgroundPermissionsAsync.mockResolvedValue({
      granted: false,
    } as never);
    candidates.mockResolvedValue([pin('p', HERE)]);
    await armGeofencing();
    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(ringer.onZoneEnter).not.toHaveBeenCalled();
  });

  it('does not arm when no position fix is available', async () => {
    location.getLastKnownPositionAsync.mockResolvedValue(null as never);
    location.getCurrentPositionAsync.mockRejectedValue(new Error('no gps'));
    candidates.mockResolvedValue([pin('p', HERE)]);
    await armGeofencing();
    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
  });
});

describe('armGeofencing seeding (the stationary-pin fix)', () => {
  it('seeds an enter for a pin the user is standing inside', async () => {
    candidates.mockResolvedValue([pin('home', HERE, 150)]);
    await armGeofencing();

    expect(location.startGeofencingAsync).toHaveBeenCalledTimes(1);
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith(['home']);
    // The fix: the enter is driven immediately, not left to Android's lagging
    // stationary-device geofence evaluation.
    expect(ringer.onZoneEnter).toHaveBeenCalledWith('home');
    expect(ringer.onZoneEnter).toHaveBeenCalledTimes(1);
  });

  it('does not seed an enter for a pin the user is outside of', async () => {
    candidates.mockResolvedValue([pin('far', north(HERE, 5_000), 150)]);
    await armGeofencing();

    expect(location.startGeofencingAsync).toHaveBeenCalledTimes(1);
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith(['far']);
    expect(ringer.onZoneEnter).not.toHaveBeenCalled();
  });

  it('seeds only the zones actually containing the user when several exist', async () => {
    candidates.mockResolvedValue([
      pin('inside', HERE, 200),
      pin('outside', north(HERE, 5_000), 150),
    ]);
    await armGeofencing();

    const seeded = ringer.onZoneEnter.mock.calls.map(([id]) => id);
    expect(seeded).toEqual(['inside']);
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith(['inside', 'outside']);
  });
});

describe('armGeofencing with nothing to monitor', () => {
  it('tears down and releases active zones when there are no candidates', async () => {
    candidates.mockResolvedValue([]);
    await armGeofencing();

    // No regions → disarm path: never registers, and reconciles to empty so a
    // previously-active zone is released rather than stranded on silent.
    expect(location.startGeofencingAsync).not.toHaveBeenCalled();
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith([]);
    expect(ringer.onZoneEnter).not.toHaveBeenCalled();
  });
});

describe('disarmGeofencing', () => {
  it('stops monitoring and releases every active zone', async () => {
    await disarmGeofencing();
    expect(location.stopGeofencingAsync).toHaveBeenCalledTimes(1);
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith([]);
  });

  it('still releases active zones even if nothing was registered', async () => {
    location.hasStartedGeofencingAsync.mockResolvedValue(false as never);
    await disarmGeofencing();
    expect(location.stopGeofencingAsync).not.toHaveBeenCalled();
    expect(ringer.reconcileActiveZones).toHaveBeenCalledWith([]);
  });
});
