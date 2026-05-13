/**
 * @swarmnote/editor-react — React component library for @swarmnote/editor-core.
 *
 * v0.2 surface:
 * - `EditorView` — React wrapper around `createEditor`
 * - `EditorToolbar` — built-in minimal toolbar (Bold/Italic/Heading/...)
 * - `I18nProvider` / `useT` — translation injection
 *
 * Host may use built-ins, wrap them, or replace with its own implementations.
 */

export { EditorView, type EditorViewHandle, type EditorViewProps } from './EditorView';
export { EditorToolbar, type EditorToolbarProps } from './EditorToolbar';
export { I18nProvider, useT, type TFunction } from './i18n';
