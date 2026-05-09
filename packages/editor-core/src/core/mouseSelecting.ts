import { StateEffect, StateField, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

/** Effect to set drag-selection state. */
export const setMouseSelecting = StateEffect.define<boolean>();

/**
 * Tracks whether the user is mid-drag selecting. Widget extensions consult
 * this to suppress decoration rebuilds during drag, preventing flicker.
 */
export const mouseSelectingField = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMouseSelecting)) {
        return effect.value;
      }
    }
    return value;
  },
});

/**
 * DOM event bridge that dispatches `setMouseSelecting` effects on mousedown
 * and mouseup, so `mouseSelectingField` reflects the current drag state.
 */
const mouseSelectingHandlers = EditorView.domEventHandlers({
  mousedown(_event, view) {
    view.dispatch({ effects: setMouseSelecting.of(true) });
    return false;
  },
  mouseup(_event, view) {
    view.dispatch({ effects: setMouseSelecting.of(false) });
    return false;
  },
});

/** Combined extension: registers the field plus the DOM event bridge. */
export const mouseSelectingExtension: Extension = [
  mouseSelectingField,
  mouseSelectingHandlers,
];
