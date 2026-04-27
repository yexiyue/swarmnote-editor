import type { ViewUpdate } from '@codemirror/view';
import { mouseSelectingField } from './mouseSelecting';

export type UpdateAction = 'rebuild' | 'skip' | 'none';

/**
 * Decides what a widget ViewPlugin should do on a `ViewUpdate`. Centralizes
 * the rebuild-vs-skip decision across drag transitions, so all live-preview
 * plugins behave consistently.
 *
 * Order matters: doc / viewport / config changes always rebuild, but during a
 * drag we skip pure selection updates to avoid flicker.
 */
export function checkUpdateAction(update: ViewUpdate): UpdateAction {
  if (
    update.docChanged ||
    update.viewportChanged ||
    update.transactions.some((t) => t.reconfigured)
  ) {
    return 'rebuild';
  }

  const isDragging = update.state.field(mouseSelectingField, false);
  const wasDragging = update.startState.field(mouseSelectingField, false);

  if (wasDragging && !isDragging) {
    return 'rebuild';
  }

  if (isDragging) {
    return 'skip';
  }

  if (update.selectionSet) {
    return 'rebuild';
  }

  return 'none';
}
