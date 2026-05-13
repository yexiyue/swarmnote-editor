/**
 * Slash command plugin (v0.3 Phase A).
 *
 * 在 `/` 字符触发位置激活 slash trigger，dispatch `SlashTriggerChange` 事件。
 * 候选项来自两个源：
 * - Plugin via `ctx.registerSlashItems(provider)`
 * - Host via `host.getSlashItems(query, signal)`
 *
 * 注册的 4 个内置命令：
 * - `slash.next` / `slash.prev` — 移动 activeIndex
 * - `slash.confirm` — 选中 activeIndex 对应的 item；调 `item.run({ view, range })`
 * - `slash.dismiss` — 关闭 trigger 并删除 `/query` 文本（slash 默认 delete on dismiss）
 *
 * v0.3 Phase A 限制：`item.commandId` 字段保留作为 metadata，但 plugin 内不执行
 * commandId 路径——commit 必须通过 `item.run` 完成。Phase B 通过 host execCommand
 * facet 补齐 commandId 路径。
 */
import type { EditorState } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { editorEventCallback, EditorEventType } from '../../../events';
import { createCharTriggerStateMachine } from '../../../internal/charTriggerStateMachine';
import { slashItemProvidersFacet } from '../../../pluginHost';
import type { EditorPlugin, SlashItem, SlashItemProvider } from '../../../types';

const HOST_PROVIDER_PRIORITY = 200;
const DEFAULT_PROVIDER_PRIORITY = 100;

export interface SlashPluginOptions {
  /** Trigger char，固定 `/`；预留 option 以备未来扩展，但只接受 `/`。 */
  triggerChar?: '/';
}

/** 过滤位置：在 CodeBlock / FencedCode / InlineCode / 数学 / FrontMatter 内不激活 */
function validateContext(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state);
  let node: ReturnType<typeof tree.resolveInner> | null = tree.resolveInner(pos, -1);
  while (node) {
    const name = node.type.name;
    if (
      name === 'FencedCode' ||
      name === 'CodeBlock' ||
      name === 'InlineCode' ||
      name === 'MathBlock' ||
      name === 'InlineMath' ||
      name === 'FrontMatter'
    ) {
      return false;
    }
    node = node.parent;
  }
  return true;
}

/** 简单 fuzzy match：title 或 keywords 任一包含 query（不区分大小写）→ 1，否则 0 */
function scoreItem(item: SlashItem, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  if (item.title.toLowerCase().includes(q)) return 1;
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) return 1;
  return 0;
}

/** 按 priority desc / score desc / id asc 排序去重 */
function sortAndDedupe(
  collected: { item: SlashItem; priority: number; score: number }[],
): SlashItem[] {
  collected.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.score !== b.score) return b.score - a.score;
    return a.item.id.localeCompare(b.item.id);
  });
  const seen = new Set<string>();
  const out: SlashItem[] = [];
  for (const e of collected) {
    if (seen.has(e.item.id)) continue;
    seen.add(e.item.id);
    out.push(e.item);
  }
  return out;
}

export function slashCommandPlugin(_options?: SlashPluginOptions): EditorPlugin {
  return {
    id: 'slash',
    version: '0.3.0',
    setup(ctx) {
      let currentView: EditorView | null = null;

      const handle = createCharTriggerStateMachine<SlashItem>({
        triggerChar: '/',
        validateContext,
        async computeItems(query, signal) {
          if (!currentView) return [];
          const providers = currentView.state.facet(slashItemProvidersFacet);
          const collected: { item: SlashItem; priority: number; score: number }[] = [];

          const fromProvider = async (p: SlashItemProvider) => {
            try {
              const items = await p.provide(query, signal);
              if (signal.aborted) return;
              for (const it of items) {
                collected.push({
                  item: it,
                  priority: p.priority ?? DEFAULT_PROVIDER_PRIORITY,
                  score: scoreItem(it, query),
                });
              }
            } catch (err) {
              if (!signal.aborted) {
                console.error(`[editor-core] slash provider "${p.id}" rejected`, err);
              }
            }
          };

          const fromHost = async () => {
            if (!ctx.host.getSlashItems) return;
            try {
              const items = await ctx.host.getSlashItems(query, signal);
              if (signal.aborted) return;
              for (const it of items) {
                collected.push({
                  item: it,
                  priority: HOST_PROVIDER_PRIORITY,
                  score: scoreItem(it, query),
                });
              }
            } catch (err) {
              if (!signal.aborted) {
                console.error('[editor-core] host.getSlashItems rejected', err);
              }
            }
          };

          await Promise.all([...providers.map(fromProvider), fromHost()]);
          if (signal.aborted) return [];
          return sortAndDedupe(collected);
        },
        onStateChange(state) {
          if (!currentView) return;
          const emit = currentView.state.facet(editorEventCallback);
          if (!emit) return;
          emit({
            kind: EditorEventType.SlashTriggerChange,
            match: state,
          });
        },
      });

      // 抓 view 引用，让 commands 与 helper computeItems 都能访问
      const viewRefCapture = EditorView.updateListener.of((u) => {
        currentView = u.view;
      });

      ctx.registerCmExtensions([handle.extension, viewRefCapture]);

      ctx.registerCommands([
        {
          id: 'slash.next',
          title: 'Slash: next item',
          when: () => handle.getState().active,
          run({ view }) {
            currentView = view;
            handle.next();
          },
        },
        {
          id: 'slash.prev',
          title: 'Slash: previous item',
          when: () => handle.getState().active,
          run({ view }) {
            currentView = view;
            handle.prev();
          },
        },
        {
          id: 'slash.confirm',
          title: 'Slash: confirm selection',
          when: () => handle.getState().active,
          run({ view }) {
            currentView = view;
            const range = handle.getState().range;
            const item = handle.confirm(view);
            if (!item) return;
            if (item.run) {
              try {
                const res = item.run({ view, range });
                if (res && typeof (res as Promise<unknown>).then === 'function') {
                  (res as Promise<unknown>).catch((err) => {
                    console.error(`[editor-core] slash item "${item.id}" run rejected`, err);
                  });
                }
              } catch (err) {
                console.error(`[editor-core] slash item "${item.id}" run threw`, err);
              }
            } else if (item.commandId) {
              // Phase A 限制：commandId 路径未在 plugin 内接通；commit 必须通过 item.run
              console.warn(
                `[editor-core] slash item "${item.id}" has commandId "${item.commandId}" but no "run" — Phase A 内 commit 必须通过 run；commandId 路径将在 Phase B 通过 execCommand facet 补齐`,
              );
            }
          },
        },
        {
          id: 'slash.dismiss',
          title: 'Slash: dismiss',
          when: () => handle.getState().active,
          run({ view }) {
            currentView = view;
            handle.dismiss(view, /* deleteTriggerText */ true);
          },
        },
      ]);

      return {
        dispose() {
          currentView = null;
        },
      };
    },
  };
}
