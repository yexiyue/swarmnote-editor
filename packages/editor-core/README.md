# @swarmnote/editor

SwarmNote 的 CodeMirror 6 Markdown 编辑器内核，提供 Markdown Live Preview 编辑体验。平台无关，可同时用于桌面端（Tauri）和移动端（React Native）。

## 特性

- Markdown 语法高亮 + Live Preview（inline rendering）
- 代码块、数学公式（KaTeX）、表格、图片的块级渲染
- Yjs CRDT 协作编辑支持
- 可定制主题（亮色 / 暗色）
- 搜索与替换
- 链接 Ctrl+Click 跳转 & 悬浮提示
- Markdown Front Matter 支持

## 安装

```bash
pnpm add @swarmnote/editor
```

## 使用

```ts
import { createEditor } from '@swarmnote/editor';

const editor = createEditor(parentElement, {
  initialText: '# Hello',
  settings: { /* EditorSettings */ },
  theme: { /* EditorThemeConfig */ },
});
```

## 导出

| 入口 | 说明 |
|------|------|
| `@swarmnote/editor` | 主入口：createEditor、EditorControl、extensions、commands |
| `@swarmnote/editor/types` | 类型定义 |
| `@swarmnote/editor/events` | 编辑器事件类型 |

## 开发

```bash
# 类型检查
pnpm typecheck
```

## License

MIT
