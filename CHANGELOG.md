# Changelog

All notable changes to the @swarmnote/editor monorepo are documented in
this file. This monorepo publishes three npm packages — `@swarmnote/editor-core`,
`@swarmnote/editor-react`, `@swarmnote/editor-react-native` — all bumped in
lockstep.

## [0.1.1](https://github.com/swarm-apps/swarmnote-editor/releases/tag/v0.1.1) - 2026-05-14

### Documentation

- drop historical narrative from READMEs
## [0.1.0](https://github.com/swarm-apps/swarmnote-editor/releases/tag/v0.1.0) - 2026-05-14

### CI/CD

- add github actions workflow (install + build + typecheck)
### Documentation

- **editor-core:** document v0.3 Plugin SDK stable surface
- refresh READMEs for v0.2 four-package layout
- Add comprehensive Chinese comments to editor-core module
- write monorepo root README + update editor-core README for new name
- add README and .gitignore
### Features

- **decorations:** polish live-preview to match Obsidian behaviour
- **editor:** redesign table widget with obsidian-style ux
- **editor:** add toggleHighlight + toggleBlockquote commands
- **editor:** wire awareness through createEditor for collab cursor
- **editor:** adopt CLM patterns — core abstractions, table rewrite, smart paste, codeblock modes, admonition
- **editor:** add format commands, keymap, imageResolver, and outline helper
- **editor:** add editable table widget, code block widget, and VS Code syntax highlighting
- **editor:** add TableWidget for rendered table preview
- **editor:** add table line decorations
- **editor-core:** SlashItem.commandArgs + lucide icon names
- **editor-core:** Notion-style link/wikilink interaction polish
- **editor-core:** implement selection toolbar runtime (v0.3 phase C)
- **editor-core:** implement wikilink runtime (v0.3 phase B)
- **editor-core:** slash.confirmAt(index) for mouse-click commit
- **editor-core:** expand slash command surface for Notion-style UX
- **editor-core:** implement slash command runtime (v0.3 phase A)
- **editor-core:** introduce plugin SDK v0.1 (**BREAKING**)
- **editor-core:** add block-level Mermaid diagram rendering extension
- **editor-react:** drop EditorToolbar, move UI primitives to registry (**BREAKING**)
- **math:** Obsidian-style block/inline math interaction
- **registry:** shadcn-style component registry for sheets/toolbar
- add editor-web / editor-react / editor-react-native packages
- tsdown build pipeline + lockfile + relax base tsconfig
- configure @swarmnote/editor-core package metadata and tsdown
- add pnpm workspace root, base tsconfig, root scripts
- obsidian-style image / html / admonition rendering
- unify bottom obstruction into setScrollBottomMargin
- scrollMargins
- add FindNext/FindPrevious commands and polish editor typography
- implement Obsidian-style Live Preview editor
- add CodeMirror 6 editor packages and WebView integration scaffold
### Miscellaneous

- **editor-core:** integrate Mermaid extension and update exports
- enforce lf line endings
- relocate package contents under packages/editor-core/ (monorepo init)
- ignore .omc working directory
### Refactor

- merge editor-web package into editor-react-native
- fix Comlink bridge issues, split editor-web into modules, migrate build to Vite

