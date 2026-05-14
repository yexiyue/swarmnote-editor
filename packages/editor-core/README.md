# @swarmnote/editor-core

CodeMirror 6 Markdown 编辑器内核，带 **live preview** 渲染。
Host 无关 — 没有 React / RN / Tauri 依赖 — 可嵌入任何 JS 前端。

## 特性

- Markdown live-preview 装饰（行内 + 块级渲染，Obsidian 风格）
- 块级 widget：代码块、KaTeX 数学公式、mermaid、表格、图片、admonition、原生 HTML
- Yjs CRDT 协作 + Awareness 在线状态
- Plugin SDK（v0.3+ 移除 `@unstable` 标记；v0.x 表面锁定）
- Slash (`/`)、wikilink (`[[`)、selection toolbar 三种 trigger 原语
- 搜索 + 替换、链接 Cmd/Ctrl 单击 + hover
- Front matter、定义列表、脚注
- DOM 无关事件载荷（适配 WebView / SSR / 非 DOM host）

## 安装

```bash
pnpm add @swarmnote/editor-core
```

> 尚未发布 npm。SwarmNote / SwarmNote-RN 通过 `pnpm.overrides` + `link:`
> 接入 sibling 仓。详见 [仓库 README](../../README.md#与-host-仓联动开发)。
>
> **React Native host 主线程不可** import `@swarmnote/editor-core` —
> 其 dep graph 含 web-only `@codemirror/*`。RN 端走
> `@swarmnote/editor-react-native/contracts`（type-only）或通过 WebView + Comlink
> 间接通信（见 `@swarmnote/editor-react-native`）。

## 用法

内置 plugin **默认不启用**。通过 `plugins[]` 显式声明：

```ts
import { createEditor, DEFAULT_SETTINGS, EditorEventType } from '@swarmnote/editor-core';
import { mathPlugin } from '@swarmnote/editor-core/plugins/math';
import { tablePlugin } from '@swarmnote/editor-core/plugins/table';
import { mermaidPlugin } from '@swarmnote/editor-core/plugins/mermaid';
import { codeBlockPlugin } from '@swarmnote/editor-core/plugins/codeBlock';
import { blockImagePlugin } from '@swarmnote/editor-core/plugins/blockImage';
import { slashCommandPlugin } from '@swarmnote/editor-core/plugins/interactions/slash';
import { wikilinkPlugin } from '@swarmnote/editor-core/plugins/interactions/wikilink';
import { selectionToolbarPlugin } from '@swarmnote/editor-core/plugins/interactions/selectionToolbar';

const editor = createEditor(parentElement, {
  initialText: '# Hello',
  settings: DEFAULT_SETTINGS,
  plugins: [
    mathPlugin(),
    tablePlugin(),
    mermaidPlugin(),
    codeBlockPlugin({ mode: 'inline' }),
    blockImagePlugin(),
    slashCommandPlugin(),
    wikilinkPlugin(),
    selectionToolbarPlugin(),
  ],
  host: {
    resolveImage: (src) => convertToAssetUrl(src),
    openLink: (url) => window.open(url),
    getSlashItems: async (query, signal) => mySlashItems(query),
    getWikilinkItems: async (query, signal) => myNoteSearch(query),
  },
  onEvent: (event) => {
    if (event.kind === EditorEventType.SlashTriggerChange) {
      // 用 event.match 渲染你的 slash popover
    }
  },
});

// 之后
editor.execCommand('toggleBold');
editor.destroy();
```

## 内置 plugin

每个通过 subpath 按需 import：

| Subpath | Plugin |
|---------|--------|
| `plugins/math` | KaTeX 行内 + 块级数学公式 |
| `plugins/table` | GFM 表格 widget + 右键菜单 |
| `plugins/mermaid` | Mermaid 图表（含缩放） |
| `plugins/admonition` | GFM / Obsidian admonition 块 |
| `plugins/codeBlock` | Fenced code block（inline / auto / toggle 三种模式） |
| `plugins/blockImage` | 块级图片 widget |
| `plugins/rawHtml` | DOMPurify 渲染原生 HTML |
| `plugins/smartPaste` | URL 转链接 + 拖拽 / 粘贴文件上传 |
| `plugins/interactions/slash` | Slash `/` 命令触发器 |
| `plugins/interactions/wikilink` | Wikilink `[[` 触发器 |
| `plugins/interactions/selectionToolbar` | 选区浮动 toolbar 触发器 |

主入口（`@swarmnote/editor-core`）**不** re-export plugin 工厂 — 保持 bundle 精简。

## Plugin SDK

实现 `EditorPlugin` 接口：

```ts
import type { EditorPlugin } from '@swarmnote/editor-core';

export function myCustomPlugin(): EditorPlugin {
  return {
    id: 'org.example.my-plugin',
    version: '1.0.0',
    setup(ctx) {
      ctx.registerCommands([
        { id: 'my.hello', run: () => console.log('hello') },
      ]);

      ctx.registerSlashItems({
        id: 'my.slash',
        provide: () => [
          {
            id: 'my.hello',
            title: 'Say hello',
            icon: 'sparkles',         // 语义名；host 端映射到 lucide
            keywords: ['hello', 'greet'],
            section: 'Custom',
            commandId: 'my.hello',    // 引用已注册命令
          },
        ],
      });

      // 注入 CM6 扩展（装饰、键绑定 ...）
      ctx.registerCmExtensions(myExtensions);

      // 订阅 editor 事件（返回 disposable）
      const dispose = ctx.on(EditorEventType.Change, (e) => {
        console.log('text changed');
      });
    },
  };
}
```

### Plugin SDK 稳定表面（v0.3+）

```ts
ctx.registerCommands(specs)                  // 命令注册
ctx.registerCmExtensions(extensions)         // 原生 CM6 扩展
ctx.registerMarkdownRenderer(rule)           // 节点级渲染规则
ctx.registerSlashItems(provider)             // slash 命令项
ctx.registerWikilinkItems(provider)          // wikilink 项
ctx.registerSelectionToolbarActions(arr)     // 选区 toolbar 按钮
ctx.on(eventType, listener) → Disposable     // 事件订阅
ctx.host                                      // EditorHostCapabilities 访问
```

`host: EditorHostCapabilities` 接受：
`resolveImage` / `uploadFile` / `openLink` / `getSlashItems` /
`getWikilinkItems` / `getSelectionToolbarActions`。

## item 形状要点

`SlashItem`（slash 命令项）：

```ts
{
  id: string;            // 唯一
  title: string;
  description?: string;
  icon?: string;         // 语义名（registry 组件映射到 lucide）
  keywords?: string[];   // 额外 fuzzy 匹配
  section?: string;      // popover 分组标题
  priority?: number;     // 排序权重（host MRU 通过它 lift）
  commandId?: string;    // → editor.execCommand(commandId, ...commandArgs)
  commandArgs?: unknown[]; // 可序列化参数（Comlink 安全）
  run?: (ctx) => void;   // commandId 的替代；不可 Comlink 序列化
}
```

`WikilinkItem` 形状类似，`commit: 'replaceWithLink' | 'jumpToNote'`
控制 commit 语义。

> **跨平台兼容**：RN host 通过 WebView Comlink 提供 items，函数 / EditorView /
> Symbol 无法序列化。**RN host items 必须走 `commandId + commandArgs` 路径**；
> 不能用 `run` closure。桌面 host（同进程）两条路径都可用。第三方 plugin
> 建议全部走 commandId 以保证两端可用。

## 公开 API 入口

`src/index.ts` 导出：

- `createEditor`、`EditorControl`
- `EditorEventType` 枚举 + 三层事件 union（`EditorCoreEvent` / `EditorInteractionEvent` / `EditorPlatformEvent`）
- `SlashTriggerMatch` / `WikilinkTriggerMatch` / `SelectionToolbarMatch` 载荷类型
- Plugin SDK 类型：`EditorPlugin`、`EditorPluginContext`、`EditorCommandSpec`、`EditorHostCapabilities`、`Disposable`、`MarkdownRenderRule`
- `editorCommands/` 下的内置命令 helper

Plugin 工厂仅通过 subpath 暴露：
`@swarmnote/editor-core/plugins/<name>`。

## 开发

```bash
pnpm build       # tsdown 一次性构建 (ESM + CJS + d.ts)
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
