/**
 * @swarmnote/editor-react-native — React Native bridge + WebView bundle for
 * `@swarmnote/editor-core`.
 *
 * v0.4 surface:
 * - `useEditorBridge` — Comlink bridge hook
 * - `useEditorFormatting` — selection formatting state hook
 * - `createRNEndpoint` / `registerTransferHandlers` / `WebViewRef` — bridge primitives
 * - `I18nProvider` / `useT` — translation injection
 *
 * The WebView HTML bundle ships in `./webview/index.html` (via the
 * `./webview` package export). Load it with `Asset.fromModule(require(
 * '@swarmnote/editor-react-native/webview'))` in your RN host.
 *
 * Types and constants used by RN host (event kinds, init options, etc.)
 * are re-exported via the `./contracts` subpath:
 *   `import { EditorEventType, ... } from '@swarmnote/editor-react-native/contracts'`.
 *
 * UI components (MarkdownEditor / EditorToolbar / Slash sheet / ...) ship
 * via the shadcn-style registry at `swarmnote-editor/registry/react-native/`.
 */

export { useEditorBridge } from './useEditorBridge';
export { useEditorFormatting } from './useEditorFormatting';
export {
  createRNEndpoint,
  registerTransferHandlers,
  type WebViewRef,
} from './comlink-webview-adapter';
export { I18nProvider, useT, type TFunction } from './i18n';
