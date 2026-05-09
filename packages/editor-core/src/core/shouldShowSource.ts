import type { EditorState } from '@codemirror/state';
import { collapseOnSelectionFacet } from './facets';
import { mouseSelectingField } from './mouseSelecting';

/**
 * Whether to reveal markdown source for `[from, to]` instead of rendering as a
 * widget. Returns true ONLY when a selection range intersects `[from, to]`.
 *
 * Short-circuits to false (= widget stays rendered) when:
 * - Live preview is disabled via `collapseOnSelectionFacet` — widgets always show
 * - User is mid-drag — prevents flicker as drag selection sweeps across widgets
 *
 * Boundary intersection is inclusive: a cursor at `range.from === to` reveals
 * the source so users can navigate into the widget's right edge.
 */
export function shouldShowSource(state: EditorState, from: number, to: number): boolean {
  if (!state.facet(collapseOnSelectionFacet)) {
    return false;
  }

  if (state.field(mouseSelectingField, false)) {
    return false;
  }

  for (const range of state.selection.ranges) {
    if (range.from <= to && range.to >= from) {
      return true;
    }
  }

  return false;
}
