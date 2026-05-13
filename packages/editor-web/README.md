# @swarmnote/editor-web

WebView runtime for `@swarmnote/editor-core`. Bundles editor-core +
Comlink endpoint into a single-file `dist/index.html`, used by the
`@swarmnote/editor-react-native` bridge to host the editor inside an
in-app WebView.

This package is **private** (not published to npm). The `dist/index.html`
is gitignored — each clone must build it locally before the RN host can
load the editor.

## Role

```text
┌──────────────────┐   ┌───────────────────────────────────────┐
│  React Native    │   │  WebView (this package's dist HTML)   │
│  ┌────────────┐  │   │  ┌──────────────────────────────────┐ │
│  │ useEditor- │──┼───┼─▶│  Comlink endpoint                │ │
│  │ Bridge     │◀─┼───┼──│   ↕                              │ │
│  └────────────┘  │   │  │  EditorRuntime (creates CM6      │ │
│                  │   │  │   via @swarmnote/editor-core)    │ │
└──────────────────┘   │  └──────────────────────────────────┘ │
                       └───────────────────────────────────────┘
```

## What it ships

- **`./dist/index.html`** — vite-built single-file bundle (~3.4 MB).
  Contains editor-core, Comlink, transferHandlers, and the WebView
  side of the bridge. RN host loads this via `Asset.fromModule` and
  injects into `react-native-webview`.
- **`./contracts` subpath** — DOM-agnostic type-only re-exports from
  editor-core plus small runtime constants (`EditorEventType`,
  `DEFAULT_EDITOR_SETTINGS`, `DEFAULT_SELECTION_FORMATTING`). RN host
  imports types and these constants without pulling in editor-core's
  web-only deps (`@codemirror/*`, KaTeX, etc.).

## Install

```bash
pnpm add @swarmnote/editor-web
```

> Not published to npm. RN hosts wire it via `pnpm.overrides`:
>
> ```json
> "overrides": {
>   "@swarmnote/editor-web": "link:../swarmnote-editor/packages/editor-web"
> }
> ```

## Usage (RN host)

```ts
import { Asset } from "expo-asset";
// type-only contracts subpath — never value-import the main entry from RN
import {
  EditorEventType,
  DEFAULT_SELECTION_FORMATTING,
  type EditorApi,
  type HostApi,
} from "@swarmnote/editor-web/contracts";

// Resolve the bundled WebView HTML
const html = Asset.fromModule(
  require("@swarmnote/editor-web/dist/index.html"),
).uri;
```

The actual bridge (Comlink wiring, event marshaling) lives in
`@swarmnote/editor-react-native` — most RN hosts depend on that package,
not on this one directly.

## Build

```bash
pnpm build       # vite build → dist/index.html + dist/index.html.map
pnpm dev         # vite build --watch
pnpm typecheck   # tsc --noEmit
```

**Don't forget to rebuild after editor-core changes** — the WebView
bundle inlines editor-core; if `editor-core/dist/` updates and you skip
the editor-web rebuild, the RN host loads stale code.

## License

MIT
