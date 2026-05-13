# @swarmnote/editor-core

SwarmNote 的 CodeMirror 6 Markdown 编辑器内核，提供 Markdown Live Preview 编辑体验。Host-agnostic — 没有 React / RN / Tauri 依赖，可被任何前端 host 嵌入。

## Features

- Markdown 语法高亮 + Live Preview（inline rendering）
- 代码块、数学公式（KaTeX）、表格、图片的块级渲染
- Yjs CRDT 协作编辑支持
- 可定制主题（亮色 / 暗色）
- 搜索与替换
- 链接 Ctrl+Click 跳转 & 悬浮提示
- Markdown Front Matter 支持

## Install

```bash
pnpm add @swarmnote/editor-core
```

> 该包暂未发布到 npm。当前 SwarmNote / SwarmNote-RN 通过 `pnpm link --global` 接入。详见 monorepo 根 [README](../../README.md#local-development)。

## Usage

v0.1 起内置功能（math / table / mermaid / admonition / codeBlock / blockImage / rawHtml / smartPaste）默认**不启用**，需要通过 `plugins[]` 显式声明。宿主能力通过 `host: EditorHostCapabilities` 注入，而非顶层 `imageResolver` / `uploadFile`（这两个字段保留但已 `@deprecated`）。

```ts
import { createEditor, DEFAULT_SETTINGS } from "@swarmnote/editor-core";
import { mathPlugin } from "@swarmnote/editor-core/plugins/math";
import { tablePlugin } from "@swarmnote/editor-core/plugins/table";
import { mermaidPlugin } from "@swarmnote/editor-core/plugins/mermaid";
import { codeBlockPlugin } from "@swarmnote/editor-core/plugins/codeBlock";
import { blockImagePlugin } from "@swarmnote/editor-core/plugins/blockImage";

const editor = createEditor(parentElement, {
  initialText: "# Hello",
  settings: DEFAULT_SETTINGS,
  host: {
    resolveImage: (src) => convertToAssetUrl(src),
    openLink: (url) => window.open(url),
  },
  plugins: [
    mathPlugin(),
    tablePlugin(),
    mermaidPlugin(),
    codeBlockPlugin({ mode: "inline" }),
    blockImagePlugin(),
  ],
});
```

### Plugin SDK

写第三方 plugin 时实现 `EditorPlugin` 接口；`setup(ctx)` 中通过 `ctx.registerCmExtensions` / `ctx.registerCommands` / `ctx.registerMarkdownRenderer` 注册贡献。Stable / `@unstable` 表面划分参见 `EditorPluginContext` TSDoc。

```ts
import type { EditorPlugin } from "@swarmnote/editor-core";

export function myPlugin(): EditorPlugin {
  return {
    id: "org.example.my-plugin",
    version: "0.1.0",
    setup(ctx) {
      ctx.registerCommands([
        { id: "my-plugin.hello", run: () => console.log("hello") },
      ]);
      // ctx.registerCmExtensions([...])
      // ctx.registerMarkdownRenderer({ nodeType: "...", extension: ... })
    },
  };
}
```

## Public API

公共 API 入口都在 `src/index.ts`：`createEditor`、`EditorControl`、`EditorEventType`、各 command helpers、Plugin SDK 类型（`EditorPlugin` / `EditorPluginContext` / `EditorCommandSpec` / `EditorHostCapabilities` / `Disposable` / `MarkdownRenderRule`）以及事件三层分类 union（`EditorCoreEvent` / `EditorInteractionEvent` / `EditorPlatformEvent`）。

8 个功能 plugin 与 3 个 interaction 占位 plugin 通过 subpath 暴露：`@swarmnote/editor-core/plugins/<name>`。主入口不再 re-export 这些 plugin 工厂。

## Development

```bash
pnpm build       # one-shot build (ESM + CJS + d.ts)
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
