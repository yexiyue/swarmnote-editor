# @swarmnote/editor-react

React component library for `@swarmnote/editor-core`, used by desktop
hosts (Tauri, Electron, browser). Provides a thin `EditorView` wrapper
around `createEditor`, an opinionated `EditorToolbar`, and an
i18n provider — all with strict singleton constraints so hosts own the
React / radix / lucide versions.

This package is part of v0.2's
[independent component library philosophy](../../README.md#packages-v02):
hosts can adopt the bundled components, extend them, or implement their
own using `@swarmnote/editor-core` directly.

## Install

```bash
pnpm add @swarmnote/editor-react
```

Peer dependencies (hosts provide their own):

- `react` ^19
- `react-dom` ^19
- `@swarmnote/editor-core` (sibling)
- `lucide-react` (toolbar icons)
- Radix-based UI primitives — list lives in `package.json` peerDeps

> Not published to npm. Desktop hosts wire it via `pnpm.overrides`:
>
> ```json
> "overrides": {
>   "@swarmnote/editor-react": "link:../swarmnote-editor/packages/editor-react"
> }
> ```

## Tailwind setup (host side)

The components ship with built-in Tailwind 4 className strings (kept
verbatim through tsdown). Hosts must add a `@source` directive so
Tailwind's content scanner can find the class names in sibling `dist`:

```css
/* host's tailwind entry (e.g. src/App.css) */
@import "tailwindcss";
@source "../../swarmnote-editor/packages/editor-react/dist/**/*.{mjs,cjs,d.mts,d.cts}";
```

## Usage

```tsx
import { useRef } from "react";
import {
  EditorView,
  EditorToolbar,
  I18nProvider,
  type EditorViewHandle,
} from "@swarmnote/editor-react";

function MyEditor() {
  const ref = useRef<EditorViewHandle>(null);

  return (
    <I18nProvider translate={(_, defaultText) => defaultText}>
      <div className="flex flex-col h-full">
        <EditorToolbar editorRef={ref} />
        <EditorView
          ref={ref}
          initialText="# Hello"
          className="flex-1 min-h-0"
        />
      </div>
    </I18nProvider>
  );
}
```

- `EditorView` is `forwardRef`. Use `ref.current.control` to get the
  `EditorControl` from editor-core (commands, state, etc.).
- `I18nProvider` accepts a `translate(id, defaultText) => string`
  callback so hosts wire their own i18n (Lingui, react-intl, …) without
  this package depending on a specific i18n library.

## Build

```bash
pnpm build       # tsdown → dist/index.{mjs,cjs,d.mts,d.cts}
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
