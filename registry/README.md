# @swarmnote/editor registry

**SwarmNote 编辑器 UI primitives** 的 shadcn 风格组件 registry。

> 状态：**v0.4 开发中** — registry 公开 URL 流程验证中。生产消费者
> 当前使用下文的手动 copy 备用路径。

## 为什么用 registry？

`@swarmnote/editor-core` 是 framework-agnostic 的引擎，
`@swarmnote/editor-react-native` 同时携带 RN 桥 + WebView bundle —
两个 npm 包覆盖运行时。UI primitives（slash popover / selection toolbar /
context menu 等）以 **shadcn 风格 copy-to-host 源码** 分发，原因：

- Host 总要 restyle / extend UI；一个"npm UI 库"层抵不上代价
- shadcn copy 让 host 完全 own 源码 — 改 Tailwind class / 换 Radix
  primitive / 删 section 都直接编辑
- 组件随 editor-core 类型演进；消费者 re-add（或拉更新）来获取改动

## 目录结构

```text
registry/
├── registry.json                  索引（shadcn schema）
├── react/                         Web（shadcn）
│   ├── components/
│   │   ├── slash-popover.tsx
│   │   ├── wikilink-popover.tsx
│   │   ├── selection-toolbar.tsx
│   │   ├── editor-context-menu.tsx
│   │   ├── editor-toolbar.tsx
│   │   └── document-outline.tsx
│   └── lib/
│       └── use-trigger-keyboard.ts        slash + wikilink 共享
└── react-native/                  RN（react-native-reusables）
    └── components/
        ├── slash-sheet.tsx
        ├── wikilink-sheet.tsx
        ├── selection-toolbar-float.tsx
        ├── editor-toolbar.tsx
        ├── heading-sheet.tsx
        └── markdown-editor.tsx             WebView wrapper
```

## v0.4 items

### Web（shadcn registry）

| 组件 | 描述 |
|------|------|
| `slash-popover` | Notion 风格 slash 命令 popover |
| `wikilink-popover` | Obsidian 风格 `[[` wikilink popover |
| `selection-toolbar` | 选区上方浮动格式化 toolbar |
| `editor-context-menu` | 右键菜单 wrapper |
| `editor-toolbar` | 桌面最小 toolbar（Bold / Italic / ...） |
| `document-outline` | 自动跟踪的大纲 sidebar |

### React Native（react-native-reusables registry）

| 组件 | 描述 |
|------|------|
| `slash-sheet` | BottomSheet 风格 slash 选择器 |
| `wikilink-sheet` | BottomSheet 风格 wikilink 选择器 |
| `selection-toolbar-float` | iOS 原生风格选区浮 toolbar |
| `editor-toolbar-rn` | 横向滚动 RN toolbar |
| `heading-sheet` | BottomSheet heading 级别选择器 |
| `markdown-editor` | WebView wrapper（加载 `@swarmnote/editor-react-native/webview`） |

## 用法

### Web（v0.4 之后 CLI；当前 dry-run）

```bash
# 一次性配置 host components.json：
{
  "registries": {
    "@swarmnote": "https://raw.githubusercontent.com/swarm-apps/swarmnote-editor/main/registry/{name}.json"
  }
}

# 添加组件：
npx shadcn add @swarmnote/slash-popover
# → registry/react/components/slash-popover.tsx → src/components/editor/slash-popover.tsx
# → registry/react/lib/use-trigger-keyboard.ts → src/lib/use-trigger-keyboard.ts
# → 确保 `popover` shadcn primitive 已安装
# → 把 @swarmnote/editor-core 加进 package.json
```

### React Native（规划中）

用 react-native-reusables CLI 加同一个 registry URL。RN items 的
metadata 设了 `"platform": "react-native"`。

### 手动 copy（永远可用）

CLI 还没跑通时，从本目录手动 copy 到 host：

- `registry/react/components/<name>.tsx` → `src/components/editor/<name>.tsx`
- `registry/react/lib/<name>.ts` → `src/lib/<name>.ts`

然后确保 `@swarmnote/editor-core` 已安装，host `tsconfig.json` 有
`@/*` → `src/*` 别名。

## 消费者契约（重要）

### Web 组件 — 依赖 Tailwind shadcn 主题

Web 组件（slash-popover / wikilink-popover / selection-toolbar /
editor-context-menu / editor-toolbar / document-outline）样式硬编码使用
shadcn 的 Tailwind CSS 变量：

- `--background` / `--foreground`
- `--muted` / `--muted-foreground`
- `--accent` / `--accent-foreground`
- `--popover` / `--popover-foreground`
- `--border`
- `--sidebar-accent` / `--sidebar-foreground`（仅 document-outline）

如果你的 host 已经走 shadcn 默认配置（`src/App.css` 或等价的 Tailwind 入口
有 `@layer base { :root { --background: ... } }`），开箱即用。
**如果用自定义主题，必须确保上述变量名存在**——否则颜色会 fallback 到
未定义状态（黑白默认）。

### RN 组件 — 默认中性色，需要时通过 `colors` prop 注入主题

RN 组件（slash-sheet / wikilink-sheet / selection-toolbar-float /
editor-toolbar / heading-sheet）默认色是中性浅色（`#fff` / `#222`
/ `#888`）。**不会自动响应深色模式**。

集成你的主题：

```tsx
import { useColorScheme } from "react-native";

const isDark = useColorScheme() === "dark";
const themeColors = isDark
  ? { background: "#1a1a1a", foreground: "#eee", muted: "#888", border: "#333", activeBg: "#333" }
  : undefined;  // 用 default 浅色

<SlashSheet match={match} onPick={onPick} colors={themeColors} />;
```

或编辑 copy 后的源码直接接入 NativeWind className。

### Comlink 序列化约束（RN host 提供 slash / wikilink items 时）

RN host 通过 `useEditorBridge({ getSlashItems, getWikilinkItems })`
向 WebView 内编辑器供 items。这两个回调返回值要**跨 Comlink RPC**，
必须 JSON-serializable：

- ✅ `commandId: "toggleHeading"` + `commandArgs: [1]` — 字符串 + 基本类型
- ✅ `commit: "replaceWithLink"` — 字符串字面量
- ❌ `run: (ctx) => { ... }` — **函数不可跨 Comlink**，到 WebView 后是 undefined

对应在 SlashItem 类型里：用 `commandId + commandArgs` 路径，不要用 `run`
closure。桌面 host 可以两种都用（同进程无序列化）；RN 必须用 commandId。

`@swarmnote/editor-core` 的内置 slash items 全部用 commandId 路径，
所以你的 host items 复用同一类型 + 同一形状即可跨平台。

### Icon 命名约定

`SlashItem.icon` / `WikilinkItem.icon` / `SelectionToolbarAction.icon` 字段
是**语义名字符串**（如 `"heading-1"` / `"file-text"` / `"bold"`），不是
图标组件。Registry 组件内置 `DEFAULT_ICON_REGISTRY` 把名字映射到
`lucide-react`（Web）/ `lucide-react-native`（RN）组件。

- 命中: 渲染对应 lucide icon
- 未命中: fallback 渲染原字符串（兼容 emoji 风格的旧 items）
- 想加自定义图标: 传 `iconRegistry` prop 扩展 default

内置语义名：

| 名字 | lucide 组件 |
|------|-----|
| `heading-1` / `heading-2` / `heading-3` | Heading1 / Heading2 / Heading3 |
| `list` / `list-ordered` / `list-todo` | List / ListOrdered / ListTodo |
| `quote` / `minus` / `calendar` | Quote / Minus / CalendarDays |
| `file-text` | FileText |
| `table` / `sigma` / `square-code` / `image` | Table / Sigma / Code / Image |
| `sticky-note` / `lightbulb` / `triangle-alert` / `circle-alert` / `octagon-alert` | StickyNote / Lightbulb / TriangleAlert / CircleAlert / OctagonAlert |
| `bold` / `italic` / `strikethrough` / `code` / `link` | Bold / Italic / Strikethrough / Code / Link |

## 配套 npm 包

```
@swarmnote/editor-core           CM6 engine + plugins                                       [npm]
@swarmnote/editor-react          EditorView + I18nProvider (plumbing only)                  [npm]
@swarmnote/editor-react-native   useEditorBridge + Comlink adapter + WebView bundle         [npm]
                                  (subpaths: /contracts 类型, /webview HTML bundle)
```

UI primitives **不在**上述 npm 包内。它们住在这里，通过 shadcn copy 分发。

> v0.4 起原 `@swarmnote/editor-web` 已合并进 `editor-react-native`，少装一个包。

## 更新

sibling 仓 registry 源码更新时：

- shadcn CLI：重跑 `npx shadcn add @swarmnote/<name>` 拉最新版本
- 手动 copy：从本目录刷新文件

`@swarmnote/editor-core` / `@swarmnote/editor-react-native` 版本升级时可能需要
重新 add registry 组件来获取类型变化。sibling 仓的 CHANGELOG.md 记录
破坏性变更。

## License

MIT（与 `@swarmnote/editor-core` 一致）
