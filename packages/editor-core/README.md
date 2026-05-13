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

> 该包暂未发布到 npm。当前 SwarmNote / SwarmNote-RN 通过 `pnpm.overrides` + `link:` 协议接入 sibling 仓。详见 monorepo 根 [README](../../README.md#local-development-with-a-host-repo)。
>
> v0.2 起本仓还包含三个姐妹包：`@swarmnote/editor-web`（WebView runtime）、`@swarmnote/editor-react`（桌面 React 组件库）、`@swarmnote/editor-react-native`（RN bridge）。RN host 主线程**不应**直接 import `@swarmnote/editor-core` 主入口——它的 dep graph 含 web-only `@codemirror/*`。RN 端走 `@swarmnote/editor-web/contracts`（type-only）或 WebView。

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

写第三方 plugin 时实现 `EditorPlugin` 接口；`setup(ctx)` 中通过 register* 方法注册贡献。

**Stable surface (v0.3)** —— v0.1 全部 `@unstable` 表面在 v0.3 都已升级 stable：

```ts
ctx.registerCommands(specs)             // 命令注册
ctx.registerCmExtensions(extensions)    // CM6 扩展注入
ctx.registerMarkdownRenderer(rule)      // 节点级 Markdown 渲染规则
ctx.registerSlashItems(provider)        // Slash 菜单候选项
ctx.registerWikilinkItems(provider)     // Wikilink 菜单候选项
ctx.registerSelectionToolbarActions(arr) // 选区工具栏 actions
ctx.on(eventType, listener)             // 订阅 editor 事件（disposable）
ctx.host                                 // 宿主能力聚合
```

**`host: EditorHostCapabilities` 接受**：
`resolveImage` / `uploadFile` / `openLink` / `getSlashItems` / `getWikilinkItems` / `getSelectionToolbarActions`。

**Plugin 内置 + 用户可扩展示例**（注册 slash item 引用已有命令）：

```ts
import type { EditorPlugin } from "@swarmnote/editor-core";

export function myPlugin(): EditorPlugin {
  return {
    id: "org.example.my-plugin",
    version: "0.1.0",
    setup(ctx) {
      // 普通命令
      ctx.registerCommands([
        { id: "my-plugin.hello", run: () => console.log("hello") },
      ]);
      // Notion-style slash item：commandId 引用已注册命令，host popover 选中后自动调
      ctx.registerSlashItems({
        id: "my-plugin.slash",
        provide: () => [
          {
            id: "my-plugin.hello",
            title: "Say hello",
            icon: "👋",
            keywords: ["hello", "greet"],
            section: "Custom",
            commandId: "my-plugin.hello",
          },
        ],
      });
    },
  };
}
```

详细机制（CharTrigger 抽象 / payload DOM-agnostic / 9 个内置 `slash.*` / `wikilink.*` / `selectionToolbar.*` 命令 / popover click 与 keyboard 协议）见 SwarmNote host 仓 `dev-notes/knowledge/editor.md` 的「Interaction trigger 三类」节。

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
