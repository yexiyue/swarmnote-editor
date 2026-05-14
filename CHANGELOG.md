# Changelog

All notable changes to the @swarmnote/editor monorepo are documented in
this file. This monorepo publishes three npm packages —
`@swarmnote/editor-core`, `@swarmnote/editor-react`,
`@swarmnote/editor-react-native` — all bumped in lockstep.

## [Unreleased]

## v0.1.0 — First npm release

Initial public release. Architecture matured through internal v0.2 → v0.4
development cycles; v0.1.0 is the first published version on npm.

### Packages shipped

- **`@swarmnote/editor-core`** — Framework-agnostic CodeMirror 6 Markdown
  editor with live-preview decorations. Includes Plugin SDK (`EditorPlugin`
  contract) and 11 built-in plugins exposed via subpaths: math / table /
  mermaid / admonition / codeBlock / blockImage / rawHtml / smartPaste /
  interactions/slash / interactions/wikilink / interactions/selectionToolbar.
- **`@swarmnote/editor-react`** — Thin React adapter: `EditorView` mount
  wrapper + `I18nProvider`. UI primitives ship via the shadcn-style
  registry (`registry/react/`).
- **`@swarmnote/editor-react-native`** — React Native bridge (`useEditorBridge`
  / `useEditorFormatting` + Comlink adapter) **plus** the WebView HTML
  bundle (subpath `./webview`) and type / constant shim (subpath
  `./contracts`). RN consumers install one npm package to get the full
  stack.

### Companion: shadcn registry

UI primitives (slash popover / wikilink popover / selection toolbar /
context menu / editor toolbar / outline / sheets) ship as **source code**
via the [shadcn-style registry](./registry/), not bundled in npm packages.
Consumers run `shadcn add @swarmnote/<name>` (or react-native-reusables
CLI for RN) to copy components into their host project.

### Key features

- Markdown live-preview decorations (Obsidian-style)
- Block widgets: code, KaTeX math, mermaid, GFM table, image, admonition, raw HTML
- Yjs CRDT collaboration + Awareness presence
- Interaction trio: slash (`/`), wikilink (`[[`), selection toolbar
- Stable Plugin SDK surface (registerCommands / registerCmExtensions /
  registerSlashItems / registerWikilinkItems / registerSelectionToolbarActions / on)
- DOM-agnostic event payloads (works across WebView / SSR / non-DOM hosts)
- React Native: Comlink-bridged commands, host-provided slash / wikilink
  item providers, WebView HTML bundled in the same npm package

### Development history (pre-publish)

Architecture milestones during internal development:

- **v0.2**: Sibling 4-package split (editor-core / editor-web / editor-react / editor-react-native)
- **v0.3**: Plugin SDK stabilization, interaction trio (slash / wikilink / selection toolbar) runtime
- **v0.4**: Live-preview polish, shadcn registry distribution model, editor-web merged into editor-react-native, contracts / webview subpaths exposed

Full internal change log lives in the SwarmNote main repo under
`openspec/changes/archive/`.
