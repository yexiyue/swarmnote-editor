/**
 * @swarmnote/editor-react-native — React Native bridge + Comlink hooks for
 * `@swarmnote/editor-web` WebView runtime.
 *
 * v0.2 surface:
 * - `useEditorBridge` — Comlink bridge hook
 * - `useEditorFormatting` — selection formatting state hook
 * - `createRNEndpoint` / `registerTransferHandlers` / `WebViewRef` — bridge primitives
 * - `I18nProvider` / `useT` — translation injection
 *
 * Built-in UI components (MarkdownEditor / EditorToolbar / EditorHeadingSheet)
 * deferred to v0.2.1 — see [`split-editor-react-packages` design.md D12]
 * for the component-library decision rationale.
 *
 * Host can construct its own WebView wrapper by combining `useEditorBridge`
 * with its preferred UI primitives until v0.2.1 ships built-ins.
 */

export { useEditorBridge } from './useEditorBridge';
export { useEditorFormatting } from './useEditorFormatting';
export {
  createRNEndpoint,
  registerTransferHandlers,
  type WebViewRef,
} from './comlink-webview-adapter';
export { I18nProvider, useT, type TFunction } from './i18n';
