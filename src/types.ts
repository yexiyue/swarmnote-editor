import type { EditorView } from '@codemirror/view';
import type { EditorEvent } from './events';

export enum EditorCommandType {
  Undo = 'undo',
  Redo = 'redo',
  ToggleBold = 'toggleBold',
  ToggleItalic = 'toggleItalic',
  ToggleCode = 'toggleCode',
  ToggleStrike = 'toggleStrike',
  ToggleHeading = 'toggleHeading',
  CycleHeading = 'cycleHeading',
  ToggleOrderedList = 'toggleOrderedList',
  ToggleUnorderedList = 'toggleUnorderedList',
  ToggleCheckList = 'toggleCheckList',
  InsertCodeBlock = 'insertCodeBlock',
  InsertHorizontalRule = 'insertHorizontalRule',
  InsertTable = 'insertTable',
  InsertLink = 'insertLink',
  InsertImage = 'insertImage',
  SelectAll = 'selectAll',
  DuplicateLine = 'duplicateLine',
  DeleteLine = 'deleteLine',
  IndentMore = 'indentMore',
  IndentLess = 'indentLess',
  InsertLineAfter = 'insertLineAfter',
  SortSelectedLines = 'sortSelectedLines',
  JumpToHash = 'jumpToHash',
  Focus = 'focus',
  Blur = 'blur',
  ScrollSelectionIntoView = 'scrollSelectionIntoView',
}

export interface EditorSelectionRange {
  anchor: number;
  head: number;
  from: number;
  to: number;
}

/**
 * Code block widget interaction mode.
 *
 * - `off` — no widget; raw markdown only
 * - `inline` (default) — fence lines collapse to header/footer widgets, code
 *   content stays in CM doc flow with full syntax highlighting and direct edit
 * - `auto` — entire block collapses to a read-only card when cursor is outside;
 *   reveal raw markdown when cursor enters
 * - `toggle` — always show as a read-only card; explicit "Code" / "Render"
 *   button toggles per-block source visibility
 */
export type CodeBlockMode = 'off' | 'inline' | 'auto' | 'toggle';

export interface EditorFeatureToggles {
  markdownHighlight: boolean;
  markdownDecorations: boolean;
  inlineRendering: boolean;
  blockImageRendering: boolean;
  codeBlockMode: CodeBlockMode;
  mathRendering: boolean;
  search: boolean;
  collaboration: boolean;
  /** URL-paste-as-link transformation and file-drop hook. Default true. */
  smartPaste: boolean;
  /** Admonition / callout block rendering (`> [!note]` etc.). Default true. */
  admonition: boolean;
}

export type EditorAppearance = 'light' | 'dark';

export interface EditorThemeConfig {
  appearance: EditorAppearance;
  fontFamily?: string;
  fontSize?: number;
  colors?: {
    background?: string;
    foreground?: string;
    selection?: string;
    activeLine?: string;
    border?: string;
    codeBackground?: string;
    heading?: string;
    link?: string;
    comment?: string;
    keyword?: string;
    string?: string;
  };
}

export interface EditorSettings {
  readonly: boolean;
  lineWrapping: boolean;
  indentWithTabs: boolean;
  tabSize: number;
  autofocus: boolean;
  spellcheck: boolean;
  editable: boolean;
  showLineNumbers: boolean;
  features: EditorFeatureToggles;
  theme: EditorThemeConfig;
}

export interface EditorSettingsUpdate
  extends Partial<Omit<EditorSettings, 'features' | 'theme'>> {
  features?: Partial<EditorFeatureToggles>;
  theme?: Partial<EditorThemeConfig>;
}

export interface SearchState {
  query: string;
  replaceQuery: string;
  caseSensitive: boolean;
  wholeWord: boolean;
  regexp: boolean;
  isOpen: boolean;
  activeMatchIndex: number | null;
  totalMatches: number;
}

export interface EditorCollaborationConfig {
  ydoc: unknown;
  fragmentName?: string;
  localOrigin?: string;
  remoteOrigin?: string;
}

export interface EditorProps {
  initialText: string;
  initialSelection?: EditorSelectionRange;
  settings: EditorSettings;
  initialSearchState?: SearchState | null;
  autofocus?: boolean;
  collaboration?: EditorCollaborationConfig;
  onEvent?: (event: EditorEvent) => void;
  /**
   * Optional resolver for `![alt](src)` image URLs. Called with the raw `src`
   * string from the Markdown source; returns the URL that will actually be
   * assigned to `<img src>`. Useful for mapping workspace-relative paths to
   * platform-specific protocols (e.g. Tauri `asset://`).
   *
   * The resolver may return a Promise. Until it resolves the widget renders
   * without a src (placeholder height only). On rejection or load error the
   * widget retries with backoff up to 3 times before showing a fallback.
   */
  imageResolver?: (src: string) => string | Promise<string>;
  /**
   * Optional file-upload handler invoked when the user drops files into the
   * editor. Receives a `File` and returns the URL plus optional alt text that
   * will be inserted as `![alt](url)` markdown at the drop position. When
   * omitted, file drops are preventDefault'd and silently ignored.
   */
  uploadFile?: (file: File) => Promise<{ url: string; alt?: string }>;
}

export interface EditorControl {
  readonly view: EditorView;

  supportsCommand(name: EditorCommandType | string): boolean;
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;

  getText(): string;
  setText(text: string): void;
  insertText(text: string): void;
  replaceSelection(text: string): void;

  getSelection(): EditorSelectionRange;
  select(anchor: number, head?: number): void;

  getSettings(): EditorSettings;
  updateSettings(settings: EditorSettingsUpdate): void;

  getSearchState(): SearchState | null;
  setSearchState(state: SearchState | null, source?: string): void;
  clearSearch(source?: string): void;

  getSelectionFormatting(): SelectionFormatting;

  focus(): void;
  blur(): void;
  destroy(): void;
}

export type ListType = 'ordered' | 'unordered' | 'check';

export interface SelectionFormatting {
  bold: boolean;
  italic: boolean;
  code: boolean;
  strikethrough: boolean;
  highlight: boolean;
  heading: number;
  listType: ListType | null;
  listLevel: number;
  inBlockquote: boolean;
  inCodeBlock: boolean;
}

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

export const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  replaceQuery: '',
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
  isOpen: false,
  activeMatchIndex: null,
  totalMatches: 0,
};

export const DEFAULT_THEME: EditorThemeConfig = {
  appearance: 'light',
};

export const DEFAULT_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
  autofocus: false,
  spellcheck: false,
  editable: true,
  showLineNumbers: false,
  theme: DEFAULT_THEME,
  features: {
    markdownHighlight: true,
    markdownDecorations: true,
    inlineRendering: true,
    blockImageRendering: true,
    codeBlockMode: 'inline',
    mathRendering: true,
    search: true,
    collaboration: true,
    smartPaste: true,
    admonition: true,
  },
};
