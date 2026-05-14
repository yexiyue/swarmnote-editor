/**
 * @swarmnote/editor-react — React plumbing layer for @swarmnote/editor-core.
 *
 * v0.4 surface (plumbing-only):
 * - `EditorView` — React wrapper around `createEditor`
 * - `I18nProvider` / `useT` — translation injection
 *
 * UI primitives (toolbar / popover / context menu / outline) are distributed
 * via the shadcn registry at `swarmnote-editor/registry/react/`; consumers
 * run `npx shadcn add @swarmnote/<name>` to copy source into their host.
 *
 * v0.4 BREAKING: `EditorToolbar` was removed from this package. Migrate to
 * the registry version: `npx shadcn add @swarmnote/editor-toolbar`.
 */

export { EditorView, type EditorViewHandle, type EditorViewProps } from './EditorView';
export { I18nProvider, useT, type TFunction } from './i18n';
