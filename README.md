# swarmnote-editor

A Markdown-first, live-preview editor built on CodeMirror 6, used by SwarmNote desktop (Tauri) and mobile (Expo + React Native) hosts. Designed to be host-agnostic and eventually publishable as a standalone open-source editor.

## Structure

This repository is a **pnpm workspace monorepo**. All shipping code lives under `packages/`.

```text
swarmnote-editor/
├── pnpm-workspace.yaml          # workspace manifest
├── package.json                 # workspace root (private, no shipping code)
├── tsconfig.base.json           # shared TS compilerOptions
└── packages/
    └── editor-core/             # @swarmnote/editor-core
        ├── package.json
        ├── tsconfig.json        # extends ../../tsconfig.base.json
        ├── tsdown.config.ts     # build config (ESM + CJS + d.ts)
        ├── src/
        └── dist/                # build output (gitignored)
```

Future siblings (not yet implemented) will follow the same shape:

- `packages/editor-react/` — React (Web / desktop) bindings + default UI
- `packages/editor-react-native/` — RN bindings + WebView host shell + bundled web runtime

## Getting Started

```bash
# 1. Clone
git clone https://github.com/swarm-apps/swarmnote-editor.git
cd swarmnote-editor

# 2. Install
pnpm install

# 3. Build all packages
pnpm build

# 4. (Optional) Watch mode for live development
pnpm dev
```

Requires Node ≥ 22 and pnpm ≥ 10.

## Local Development

When working on the editor while also running a host app (`SwarmNote` Tauri desktop or `SwarmNote-RN` mobile), use **pnpm link --global** to wire your local editor build into the host’s `node_modules`:

### One-time setup in this repo

```bash
# Build first so dist/ exists (link target)
pnpm -r build

# Register editor-core globally
cd packages/editor-core
pnpm link --global
```

For continuous development, run `pnpm dev` (= `tsdown --watch`) so `dist/` rebuilds on every source edit.

### Wire it into a host repo

```bash
# In the SwarmNote (desktop) repo
cd /path/to/SwarmNote
pnpm link --global @swarmnote/editor-core

# In the SwarmNote-RN (mobile) repo: link both root and editor-web
cd /path/to/SwarmNote-RN
pnpm link --global @swarmnote/editor-core
(cd packages/editor-web && pnpm link --global @swarmnote/editor-core)
```

### React Native / Metro caveat

Metro does not natively follow `pnpm link` symlinks across repos. The host’s `metro.config.js` must add the editor-core path to `watchFolders` and to `resolver.extraNodeModules`. SwarmNote-RN does this via the `EDITOR_CORE_LOCAL_PATH` environment variable (default: `../swarmnote-editor/packages/editor-core`). See its README for details.

## Packages

### `@swarmnote/editor-core`

Markdown-first editor core built on CodeMirror 6. Host-agnostic: depends only on `@codemirror/*`, `@lezer/*`, `yjs`, `y-codemirror.next`, `dompurify`, `katex`. No React, no React Native, no Tauri.

**Public API entry**: `src/index.ts` (re-exports `createEditor`, `EditorControl`, `EditorEventType`, command helpers, extension factories, type definitions).

**Build output**: `dist/index.{mjs,cjs,d.mts,d.cts}` plus sourcemaps. Runtime dependencies are externalised — host repos share their own copies of CodeMirror / yjs to avoid double-instantiation.

```ts
import { createEditor } from "@swarmnote/editor-core";

const editor = createEditor(parentElement, {
  initialText: "# Hello",
  settings: { /* EditorSettings */ },
  theme: { /* EditorThemeConfig */ },
});
```

## Status

This package is **not yet published to npm**. Both host repos consume it via `pnpm link --global` during local development. A first npm publish is tracked as a separate change (out of scope of the monorepo init that produced this layout).

The wider editor extraction roadmap — `editor-react`, `editor-react-native`, slash commands, floating toolbar, wikilinks — lives in the SwarmNote main repo under `dev-notes/plans/editor-open-source-rfc.md` and corresponding OpenSpec changes.

## License

MIT
