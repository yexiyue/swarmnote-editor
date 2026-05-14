# @swarmnote/editor-react

`@swarmnote/editor-core` 的 React plumbing 层。给桌面 host（Tauri / Electron / 浏览器）用。

本包仅提供最薄的接线：`EditorView` mount/unmount wrapper + `I18nProvider`。
UI primitives（toolbar / slash popover / wikilink popover / selection toolbar /
context menu / document outline）通过 [shadcn 风格 registry](../../registry/) 分发 —
`shadcn add` 把源码 copy 到 host，host own 完整源码可自由改样式。

## 本包导出

| 导出 | 用途 |
|------|------|
| `EditorView` | 包装 `createEditor` 的 React 组件（mount 生命周期 + ref-forwarded `EditorControl`） |
| `EditorViewProps` | Props（继承 editor-core 的 `EditorProps` + `className`/`style`） |
| `EditorViewHandle` | 命令式 ref 形状（`{ control }`） |
| `I18nProvider` | `t(id, defaultText) => string` 回调的 context provider |
| `useT` | 读取 i18n context |
| `TFunction` | `t` 函数的类型 |

## 安装

```bash
pnpm add @swarmnote/editor-react @swarmnote/editor-core
```

Peer 依赖（host 自带）：

- `react` ^19
- `react-dom` ^19
- `@swarmnote/editor-core`

## 用法

```tsx
import { useRef, useState } from 'react';
import { EditorView, I18nProvider, type EditorViewHandle } from '@swarmnote/editor-react';
import { mathPlugin } from '@swarmnote/editor-core/plugins/math';
import { tablePlugin } from '@swarmnote/editor-core/plugins/table';
import { slashCommandPlugin } from '@swarmnote/editor-core/plugins/interactions/slash';

export function MyEditor() {
  const ref = useRef<EditorViewHandle>(null);

  return (
    <I18nProvider t={(_, defaultText) => defaultText}>
      <EditorView
        ref={ref}
        initialText="# Hello"
        plugins={[mathPlugin(), tablePlugin(), slashCommandPlugin()]}
        host={{
          resolveImage: (src) => convertToAssetUrl(src),
          openLink: (url) => window.open(url),
          getSlashItems: async (q) => mySlashProvider(q),
        }}
        onEvent={(e) => console.log(e)}
        className="h-full"
      />
    </I18nProvider>
  );
}
```

- `EditorView` 是 `forwardRef`。通过 `ref.current?.control` 访问
  `EditorControl`（命令、状态、focus、search 等）。
- CodeMirror 6 不支持 mount 后的 prop 响应式更新 — 改 `plugins` /
  `settings` / `collaboration` 需要通过 React `key` 强制 remount。
- `I18nProvider` 是一个薄 context。实现 `t(id, defaultText) => string`
  回调来接你的 i18n 库（Lingui / react-intl / native / ...）。

## 配合 registry UI 使用

多数生产 host 还会从 [registry](../../registry/) 拉这些：

```bash
npx shadcn add @swarmnote/slash-popover
npx shadcn add @swarmnote/wikilink-popover
npx shadcn add @swarmnote/selection-toolbar
npx shadcn add @swarmnote/document-outline
npx shadcn add @swarmnote/editor-toolbar
npx shadcn add @swarmnote/editor-context-menu
```

源码落到 `src/components/editor/` 和 `src/lib/`。你 own — 改样式随意。

通过订阅 trio 事件喂给 popover：

```tsx
const [slashMatch, setSlashMatch] = useState(null);

<EditorView
  onEvent={(e) => {
    if (e.kind === EditorEventType.SlashTriggerChange) {
      setSlashMatch(e.match.active ? e.match : null);
    }
  }}
/>
<SlashPopover match={slashMatch} control={ref.current?.control ?? null} />
```

## 构建

```bash
pnpm build       # tsdown → dist/index.{mjs,cjs,d.mts,d.cts}
pnpm dev         # tsdown --watch
pnpm typecheck   # tsc --noEmit
```

## License

MIT
