import type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorFeatureToggles,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
  SelectionFormatting,
  SelectionToolbarMatch,
  SlashItem,
  SlashTriggerMatch,
  WikilinkItem,
  WikilinkTriggerMatch,
} from '@swarmnote/editor-core';

export type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorFeatureToggles,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
  SelectionFormatting,
  SelectionToolbarMatch,
  SlashItem,
  SlashTriggerMatch,
  WikilinkItem,
  WikilinkTriggerMatch,
};

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
  autofocus: false,
  spellcheck: false,
  editable: true,
  showLineNumbers: false,
  features: {
    markdownHighlight: true,
    markdownDecorations: true,
    inlineRendering: true,
    search: true,
    collaboration: true,
  },
  theme: { appearance: 'light' },
};

export const DEFAULT_SELECTION_FORMATTING: SelectionFormatting = {
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  highlight: false,
  heading: 0,
  listType: null,
  listLevel: 0,
  inBlockquote: false,
  inCodeBlock: false,
};

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
  MermaidZoomRequest: 'mermaidZoomRequest',
  /**
   * Interaction trio events — emitted by built-in `slashCommandPlugin` /
   * `wikilinkPlugin` / `selectionToolbarPlugin` and forwarded by editor-web
   * to RN host via `host.onEditorEvent`. Stable as of v0.4. Types from
   * `@swarmnote/editor-core` (re-exported above).
   */
  SlashTriggerChange: 'slashTriggerChange',
  WikilinkTriggerChange: 'wikilinkTriggerChange',
  SelectionToolbarChange: 'selectionToolbarChange',
} as const;
