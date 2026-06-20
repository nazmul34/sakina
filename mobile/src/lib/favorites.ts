/**
 * Favorited / saved messages (F-04.5 / FR-4.4).
 *
 * Storage decision — **local-only**, via AsyncStorage (documented in
 * mobile/README.md → "Saved messages"). We persist the *whole* message object
 * (text, source, category), not just its id, so the saved list renders fully
 * offline with no follow-up `GET /messages/:id`. A server-synced favorites list
 * (`GET /messages/saved`) is deferred to EPIC-07, where cross-device sync is
 * designed holistically; until then this is a per-device list, consistent with
 * the other offline caches ([[mosquesCache]]).
 *
 * This module is a tiny reactive store: an in-memory mirror of the persisted
 * list plus a `useSyncExternalStore` hook, so the favorite toggle on the Daily
 * message screen and the Saved list screen always agree without re-reading
 * storage on every focus. Reads/writes are best-effort — a corrupt or
 * unavailable store degrades to an empty list, never a crash.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { IslamicMessage } from './messagesApi';

const STORAGE_KEY = 'sakina.favorites';

type Listener = () => void;

// In-memory mirror of the persisted favorites (newest first). Reassigned (never
// mutated in place) on every change so `useSyncExternalStore` sees a new
// reference and re-renders subscribers.
let favorites: IslamicMessage[] = [];
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function isMessage(value: unknown): value is IslamicMessage {
  const m = value as Partial<IslamicMessage> | null;
  return (
    m !== null &&
    typeof m === 'object' &&
    typeof m.id === 'string' &&
    typeof m.text === 'string' &&
    typeof m.category === 'string'
  );
}

function persist(): void {
  // Best-effort — a failed write must not turn a successful toggle into an error.
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites)).catch(() => {});
}

/** Load the persisted list into memory once, then notify subscribers. */
function hydrate(): Promise<void> {
  if (hydrated) {
    return Promise.resolve();
  }
  if (hydrating === null) {
    hydrating = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
          const parsed: unknown = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            favorites = parsed.filter(isMessage);
          }
        }
      } catch {
        // keep the empty list
      }
      hydrated = true;
      emit();
    })();
  }
  return hydrating;
}

/** Whether a message id is currently in the saved list (synchronous, in-memory). */
export function isFavorited(id: string): boolean {
  return favorites.some((m) => m.id === id);
}

/** Add the message if absent, remove it if present. Persists + notifies. */
export function toggleFavorite(message: IslamicMessage): void {
  favorites = isFavorited(message.id)
    ? favorites.filter((m) => m.id !== message.id)
    : [message, ...favorites];
  persist();
  emit();
}

/** Remove a message from the saved list by id. No-op if not saved. */
export function removeFavorite(id: string): void {
  if (!isFavorited(id)) {
    return;
  }
  favorites = favorites.filter((m) => m.id !== id);
  persist();
  emit();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  void hydrate();
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): IslamicMessage[] {
  return favorites;
}

/**
 * Reactive saved-messages list + mutators. The list hydrates from storage on
 * first mount (starting empty), so consumers re-render once it loads.
 */
export function useFavorites(): {
  favorites: IslamicMessage[];
  toggleFavorite: (message: IslamicMessage) => void;
  removeFavorite: (id: string) => void;
} {
  const list = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { favorites: list, toggleFavorite, removeFavorite };
}
