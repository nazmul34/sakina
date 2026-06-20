/**
 * Client for `GET /messages/random` (F-04.1).
 *
 * The backend returns one random active Islamic message, optionally filtered
 * by category. No device-identity header is needed — messages are public
 * content — but apiFetch attaches it anyway (harmless) for consistency.
 */

import { apiFetch } from './api';

export type MessageCategory = 'quran' | 'hadith' | 'dua' | 'reminder';

export interface IslamicMessage {
  readonly id: string;
  readonly text: string;
  readonly source_label: string;
  readonly category: MessageCategory;
}

/**
 * Fetch a random active message from the backend.
 * Pass `category` to restrict results to that category.
 * Throws on network error or non-2xx response.
 */
export async function fetchRandomMessage(
  category?: MessageCategory,
): Promise<IslamicMessage> {
  const path = category
    ? `messages/random?category=${category}`
    : 'messages/random';

  const response = await apiFetch(path);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      (body as { detail?: string }).detail ?? `messages API ${response.status}`,
    );
  }

  return (await response.json()) as IslamicMessage;
}

/**
 * Compose the plain-text payload for sharing a message (F-04.3).
 * Appends the source label on its own line when present, e.g.
 *
 *   Indeed, with hardship comes ease.
 *   — Qur'an 94:6
 */
export function composeShareText(message: IslamicMessage): string {
  const label = message.source_label.trim();
  return label ? `${message.text}\n\n— ${label}` : message.text;
}
