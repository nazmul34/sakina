/**
 * Background geofencing task (FR-1.2).
 *
 * `TaskManager.defineTask` must run at module scope, not inside a component: when
 * the OS delivers a geofence transition while the app is backgrounded or killed,
 * it spins up the JS runtime headless — no React tree is mounted — runs this
 * task, and shuts down. The task is therefore deliberately thin: it routes the
 * enter/exit straight to the native ringer state machine (F-01.3), which owns all
 * the persistence, reference-counting, and restoration.
 *
 * This file is imported for its side effect from `index.ts` (the app entry), so
 * the task is defined before TaskManager ever needs it — including on a headless
 * launch, where the entry module still runs.
 */

import { GeofencingEventType, type LocationRegion } from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import RingerControl from '../../../modules/ringer-control';
import { GEOFENCING_TASK } from './constants';

interface GeofencingTaskData {
  eventType: GeofencingEventType;
  region: LocationRegion;
}

TaskManager.defineTask<GeofencingTaskData>(
  GEOFENCING_TASK,
  async ({ data, error }) => {
    if (error) {
      console.warn('[geofencing] task error:', error.message);
      return;
    }
    if (!data) {
      return;
    }

    const { eventType, region } = data;
    // identifier is always set: we register every region with an explicit id.
    const id = region.identifier ?? '';
    if (!id) {
      return;
    }

    if (eventType === GeofencingEventType.Enter) {
      RingerControl.onZoneEnter(id);
    } else if (eventType === GeofencingEventType.Exit) {
      RingerControl.onZoneExit(id);
    }
  },
);
