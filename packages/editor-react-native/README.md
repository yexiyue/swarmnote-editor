# @swarmnote/editor-react-native

React Native bridge library for `@swarmnote/editor-core` via the
`@swarmnote/editor-web` WebView. Ships the Comlink endpoint adapter,
the `useEditorBridge` / `useEditorFormatting` hooks, and an i18n
provider — but **not** the UI shell (MarkdownEditor / Toolbar etc),
which is deferred to v0.2.1.

This package is part of v0.2's
[independent component library philosophy](../../README.md#packages-v02):
hosts compose the bridge with their own RN UI today; bundled UI
components ship in v0.2.1.

## Install

```bash
pnpm add @swarmnote/editor-react-native
```

Peer dependencies (hosts provide their own):

- `react` ^19
- `react-native` ≥ 0.83
- `comlink` ^4.4.2
- `@swarmnote/editor-core` (sibling, type-only — see below)
- `@swarmnote/editor-web` (sibling)

> Not published to npm. RN hosts wire it via `pnpm.overrides`:
>
> ```json
> "overrides": {
>   "@swarmnote/editor-core": "link:../swarmnote-editor/packages/editor-core",
>   "@swarmnote/editor-web": "link:../swarmnote-editor/packages/editor-web",
>   "@swarmnote/editor-react-native": "link:../swarmnote-editor/packages/editor-react-native"
> }
> ```

## Metro caveats

Metro doesn't out-of-the-box follow sibling pnpm symlinks, and double-React
breaks hooks. The minimum host `metro.config.js` looks like:

```js
const siblingRoot = path.resolve(__dirname, "../swarmnote-editor");

config.watchFolders = [...(config.watchFolders ?? []), siblingRoot];
config.resolver.unstable_enableSymlinks = true;
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  "@swarmnote/editor-core": path.join(siblingRoot, "packages/editor-core"),
  "@swarmnote/editor-web": path.join(siblingRoot, "packages/editor-web"),
  "@swarmnote/editor-react-native": path.join(siblingRoot, "packages/editor-react-native"),
};

// Pin singletons to host node_modules so sibling devDeps don't load a 2nd React.
const HOST_SINGLETONS = new Set([
  "react", "react/jsx-runtime", "react/jsx-dev-runtime",
  "react/compiler-runtime", "react-native", "scheduler",
]);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (HOST_SINGLETONS.has(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(__dirname, "package.json") },
      moduleName, platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};
```

If the host enables `experiments.reactCompiler` in `app.json`, also
scope React Compiler in `babel.config.js`:

```js
["babel-preset-expo", {
  "react-compiler": { sources: (f) => f.startsWith(path.join(__dirname, "src") + path.sep) },
}]
```

## NativeWind setup (host side)

The hooks themselves don't carry className strings (UI shell is
deferred to v0.2.1). When v0.2.1 lands, hosts will need a NativeWind 5
`@source` directive scanning `editor-react-native/dist/**/*.{mjs,cjs,d.mts,d.cts}`.

## Usage

```tsx
import { useRef } from "react";
import WebView from "react-native-webview";
import {
  useEditorBridge,
  useEditorFormatting,
  I18nProvider,
} from "@swarmnote/editor-react-native";

function MyEditor({ docUuid, initialState, onCollabUpdate }) {
  const webViewRef = useRef<WebView>(null);

  const { editorApi, ready } = useEditorBridge({
    webViewRef,
    onCollaborationUpdate: onCollabUpdate,
    onEditorEvent: handleEditorEvent,
  });

  const { formatting, handleEditorEvent } = useEditorFormatting(onEditorEvent);

  return (
    <I18nProvider translate={(_, defaultText) => defaultText}>
      <WebView ref={webViewRef} source={{ uri: editorWebViewHtml }} />
    </I18nProvider>
  );
}
```

The bridge uses Comlink with a `Uint8Array` transfer handler so binary
Y.Doc updates survive the RN ↔ WebView boundary. See `comlink-webview-adapter`
for the message-envelope format.

## Build

```bash
pnpm build       # tsdown → dist/index.{mjs,cjs,d.mts,d.cts}
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
