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

```ts
import { createEditor } from "@swarmnote/editor-core";

const editor = createEditor(parentElement, {
  initialText: "# Hello",
  settings: { /* EditorSettings */ },
  theme: { /* EditorThemeConfig */ },
});
```

## Public API

公共 API 入口都在 `src/index.ts`：`createEditor`、`EditorControl`、`EditorEventType`、各 command helpers、各 extension factories、类型定义等。

## Development

```bash
pnpm build       # one-shot build (ESM + CJS + d.ts)
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
