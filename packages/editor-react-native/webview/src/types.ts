import type { SlashItem, WikilinkItem } from '@swarmnote/editor-core';
import type {
  EditorCollaborationConfig,
  EditorCommandType,
  EditorEvent,
  EditorSelectionRange,
  EditorSettings,
  EditorSettingsUpdate,
  SearchState,
} from './contracts';

/** Built-in plugin ids the editor-web runtime knows how to enable. */
export type RuntimePluginId =
  | 'math'
  | 'table'
  | 'mermaid'
  | 'admonition'
  | 'codeBlock'
  | 'blockImage'
  | 'rawHtml'
  | 'smartPaste'
  | 'slash'
  | 'wikilink'
  | 'selectionToolbar';

export type RuntimeCodeBlockMode = 'inline' | 'auto' | 'toggle';

export interface RuntimeInitOptions {
  initialText: string;
  initialSelection?: EditorSelectionRange;
  settings: EditorSettings;
  initialSearchState?: SearchState | null;
  autofocus?: boolean;
  collaboration?: EditorCollaborationConfig;
  /**
   * Local filesystem path of the active workspace. When set, the runtime
   * resolves workspace-relative image src `![](images/foo.png)` into
   * `file://<workspacePath>/images/foo.png` so the WebView can load them.
   * Absolute schemes (http/https/data/blob/asset/file/tauri) pass through.
   */
  workspacePath?: string;
  /**
   * List of built-in plugin ids to enable. Order is preserved. Omit to
   * enable the default full set (all 11 plugins). Pass `[]` to disable all.
   *
   * v0.4: added so RN hosts can wire feature toggles to the WebView editor.
   * Without this, the WebView ran with zero plugins — table / math / mermaid
   * / slash / wikilink / selection toolbar were all silently disabled.
   */
  enabledPluginIds?: readonly RuntimePluginId[];
  /** codeBlock plugin rendering mode. Defaults to 'inline'. */
  codeBlockMode?: RuntimeCodeBlockMode;
}

export interface RuntimeCreateEditorOptions extends RuntimeInitOptions {}

/**
 * Identity fields written into the local awareness state under `user`.
 * `y-codemirror.next` reads `user.name` / `user.color` to render remote
 * caret labels; the other fields are consumed by PresenceAvatars UI.
 */
export interface AwarenessUserState {
  name: string;
  platform: 'desktop' | 'mobile';
  deviceId: string;
  color: string;
}

export interface EditorApi {
  createEditor(options: RuntimeCreateEditorOptions): void;
  destroyEditor(): void;
  getText(): string;
  setText(text: string): void;
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;
  updateSettings(settings: EditorSettingsUpdate): void;
  applyRemoteCollaborationUpdate(update: Uint8Array): void;
  /** Apply a remote `y-protocols/awareness` update (encodeAwarenessUpdate
   *  bytes from another peer). Top-level Uint8Array — see HostApi note. */
  applyRemoteAwarenessUpdate(update: Uint8Array): void;
  /** Write the local user identity into awareness state. Call once after
   *  createEditor in collab mode; the runtime publishes the resulting
   *  awareness diff via `host.onAwarenessUpdate`. */
  setLocalUserState(state: AwarenessUserState): void;
  select(selection: EditorSelectionRange): void;
  focus(): void;
  blur(): void;
  /** Set the bottom scroll margin in pixels — host calls this with the height
   *  of any UI overlaying the editor (keyboard + toolbar / floating bar) so
   *  CodeMirror keeps the cursor above the overlay during scrollIntoView. */
  setScrollBottomMargin(px: number): void;
  setSearchState(state: SearchState | null, source?: string): void;
}

export interface HostApi {
  onRuntimeReady(): void;
  onEditorEvent(event: EditorEvent): void;
  /** Dedicated channel for Y.Doc updates. Lives outside `onEditorEvent`
   *  because Comlink's transferHandler only fires on top-level RPC
   *  arguments — when the binary is nested inside an event object the
   *  custom JSON envelope strips its `Uint8Array` type, leaving the host
   *  with `{"0":N,"1":N,...}` and an undefined `byteLength`. Passing the
   *  update as a top-level argument keeps the `uint8array` transferHandler
   *  effective. */
  onCollaborationUpdate(update: Uint8Array): void;
  /** Awareness updates from local edits. Same top-level-Uint8Array rule. */
  onAwarenessUpdate(update: Uint8Array): void;
  /** Remote-only presence snapshot, recomputed every awareness change.
   *  RN cannot inspect the in-WebView Awareness instance directly, so this
   *  is the channel for PresenceAvatars / online-list UI. JSON-serializable
   *  by design, no Uint8Array — safe inside event objects. */
  onPresenceChange(users: AwarenessUserState[]): void;
  log(message: string): void;
  /**
   * v0.4: provide slash command items for the current query. Called by the
   * editor's slashCommandPlugin when the user types `/`. Returns empty array
   * when host has no items (popover shows "no matching"). Items SHOULD use
   * `commandId` + `commandArgs` instead of `run` closures — closures don't
   * survive Comlink serialization.
   *
   * `AbortSignal` is intentionally not part of this RPC: signal objects don't
   * cross Comlink. The editor's internal stale-response handling discards
   * superseded queries based on local match revision.
   */
  getSlashItems(query: string): Promise<SlashItem[]>;
  /**
   * v0.4: provide wikilink items for the current query. Same Comlink
   * serialization rule applies — items must be JSON-serializable. Items
   * with `commit: 'replaceWithLink'` work transparently; `commit:
   * 'jumpToNote'` requires host to subscribe to the on-confirm event
   * (separate mechanism).
   */
  getWikilinkItems(query: string): Promise<WikilinkItem[]>;
}

export interface RuntimeState {
  editorReady: boolean;
  runtimeReady: boolean;
}

export type { EditorEvent };

export type EditorInitOptions = RuntimeInitOptions;
export type HostEventHandler = HostApi['onEditorEvent'];
