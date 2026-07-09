/**
 * Serialize OS permission requests app-wide.
 *
 * Android allows only one in-flight `requestPermissions` call — a second while
 * one is open throws *"Can request only one set of permissions at a time"* and
 * that ask is lost. That overlap is easy to hit here: the first-launch prompt
 * asks for notifications then location, while a screen mounting at the same time
 * independently asks for location on use. Routing every *request* (not the cheap
 * status reads) through this queue guarantees the system dialogs appear one after
 * another instead of racing.
 */

// Tail of the chain; each task runs after the previous settles.
let tail: Promise<unknown> = Promise.resolve();

/** Run `task` once all previously queued permission requests have settled. */
export function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  // Advance the tail but swallow errors so one failure never blocks the queue.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
