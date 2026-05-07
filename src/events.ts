import { Facet } from '@codemirror/state';
import type { EditorSelectionRange, SearchState, SelectionFormatting } from './types';

export const EditorEventType = {
  Change: 'change',
  SelectionChange: 'selectionChange',
  SelectionFormattingChange: 'selectionFormattingChange',
  Focus: 'focus',
  Blur: 'blur',
  SearchStateChange: 'searchStateChange',
  CollaborationUpdate: 'collaborationUpdate',
  LinkOpen: 'linkOpen',
  Remove: 'remove',
  TableContextMenu: 'tableContextMenu',
} as const;

export type EditorEventType = (typeof EditorEventType)[keyof typeof EditorEventType];

export interface EditorChangeEvent {
  kind: typeof EditorEventType.Change;
}

export interface EditorSelectionChangeEvent {
  kind: typeof EditorEventType.SelectionChange;
  selection: EditorSelectionRange;
}

export interface EditorFocusEvent {
  kind: typeof EditorEventType.Focus;
}

export interface EditorBlurEvent {
  kind: typeof EditorEventType.Blur;
}

export interface EditorSearchStateChangeEvent {
  kind: typeof EditorEventType.SearchStateChange;
  search: SearchState | null;
  source?: string;
}

export interface EditorCollaborationUpdateEvent {
  kind: typeof EditorEventType.CollaborationUpdate;
  update: Uint8Array;
}

export interface EditorSelectionFormattingChangeEvent {
  kind: typeof EditorEventType.SelectionFormattingChange;
  formatting: SelectionFormatting;
}

export interface EditorLinkOpenEvent {
  kind: typeof EditorEventType.LinkOpen;
  url: string;
}

export interface EditorRemoveEvent {
  kind: typeof EditorEventType.Remove;
}

export type TableAlignment = 'left' | 'center' | 'right' | null;

/**
 * Imperative actions a table widget exposes to the host React layer when it
 * raises a context menu. Each call mutates the markdown document via a single
 * CodeMirror dispatch and lets the React menu close without further coupling.
 */
export interface TableContextMenuActions {
  addRowAt(rowIdx: number, position: 'above' | 'below'): void;
  deleteRow(rowIdx: number): void;
  addColumnAt(colIdx: number, position: 'left' | 'right'): void;
  deleteColumn(colIdx: number): void;
  setAlignment(colIdx: number, alignment: TableAlignment): void;
  toggleSource(): void;
  copyMarkdown(): void;
  deleteTable(): void;
}

export interface EditorTableContextMenuEvent {
  kind: typeof EditorEventType.TableContextMenu;
  clientX: number;
  clientY: number;
  /** -1 if the right-click target is the header row, otherwise tbody row index. */
  rowIdx: number;
  colIdx: number;
  alignment: TableAlignment;
  rowCount: number;
  colCount: number;
  actions: TableContextMenuActions;
}

export type EditorEvent =
  | EditorChangeEvent
  | EditorSelectionChangeEvent
  | EditorSelectionFormattingChangeEvent
  | EditorFocusEvent
  | EditorBlurEvent
  | EditorSearchStateChangeEvent
  | EditorCollaborationUpdateEvent
  | EditorLinkOpenEvent
  | EditorRemoveEvent
  | EditorTableContextMenuEvent;

/**
 * Facet that pipes the host's `onEvent` callback into the CodeMirror state
 * tree, so widgets (which run inside StateFields and only have a `view`
 * reference) can dispatch high-level events back to React without growing
 * the public widget surface.
 */
export const editorEventCallback = Facet.define<
  ((event: EditorEvent) => void) | undefined,
  ((event: EditorEvent) => void) | undefined
>({
  combine: (values) => values.find((v): v is (event: EditorEvent) => void => Boolean(v)),
});
