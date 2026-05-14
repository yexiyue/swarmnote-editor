// Public re-export shim for the WebView runtime's types + constants.
// Imported by RN host code via `@swarmnote/editor-react-native/contracts`.
//
// Internal `editor-react-native/src/*.ts` files import via relative paths
// (`./webview/src/...`) to avoid a circular package alias.

export {
  DEFAULT_EDITOR_SETTINGS,
  DEFAULT_SELECTION_FORMATTING,
  EditorEventType,
} from '../webview/src/contracts';
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
} from '../webview/src/contracts';
export type {
  AwarenessUserState,
  EditorApi,
  EditorInitOptions,
  HostApi,
  HostEventHandler,
  RuntimeCodeBlockMode,
  RuntimeCreateEditorOptions,
  RuntimePluginId,
  RuntimeState,
} from '../webview/src/types';
