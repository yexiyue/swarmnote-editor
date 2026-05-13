import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type {
  Disposable,
  EditorCommandContext,
  EditorCommandSpec,
  EditorHostCapabilities,
  EditorPlugin,
  EditorPluginContext,
  EditorPluginInstance,
  EditorProps,
  MarkdownRenderRule,
} from './types';
import { createSelectionRange } from './utils';

interface PluginHostState {
  commands: Map<string, EditorCommandSpec>;
  extensions: Extension[];
  renderers: Map<string, MarkdownRenderRule>;
  disposables: Disposable[];
  instances: EditorPluginInstance[];
}

export interface PluginHost {
  /** Plugin 注册的 CM 扩展，在 createEditor 中合并进 EditorState */
  readonly extensions: readonly Extension[];
  /**
   * 尝试执行 plugin 注册的命令。
   * - 返回 `true`：命中（且已执行 / 被 `when` 否决）
   * - 返回 `false`：未命中，应 fallback 到内置命令
   */
  execPluginCommand(view: EditorView, id: string): boolean;
  /** Editor 销毁时调用：反向 dispose 全部 disposable 与 plugin 实例 */
  destroy(): void;
}

/**
 * 合并 deprecated 顶层字段 (`imageResolver` / `uploadFile`) 到 host 对象。
 *
 * - 仅 deprecated 字段存在 → 桥接到 host.*
 * - 仅 host.* 存在 → 直接使用
 * - 双方都存在 → host.* 优先，触发一次 console.warn（按字段聚合一次）
 */
export function mergeHostCapabilities(
  host: EditorHostCapabilities | undefined,
  imageResolver: EditorProps['imageResolver'],
  uploadFile: EditorProps['uploadFile'],
): EditorHostCapabilities {
  const merged: EditorHostCapabilities = { ...(host ?? {}) };
  const conflicts: string[] = [];
  const bridge = <K extends keyof EditorHostCapabilities>(
    field: K,
    legacy: EditorHostCapabilities[K] | undefined,
  ) => {
    if (!legacy) return;
    if (host?.[field]) conflicts.push(String(field));
    else merged[field] = legacy;
  };
  bridge('resolveImage', imageResolver);
  bridge('uploadFile', uploadFile);
  if (conflicts.length) {
    console.warn(
      `[editor-core] EditorProps deprecated field(s) [${conflicts.join(', ')}] conflict with host.* — host.* takes precedence.`,
    );
  }
  return merged;
}

/**
 * 创建 plugin host：遍历 `plugins` 依次调用 `setup(ctx)`，收集每个 plugin
 * 注册的命令 / CM 扩展 / Markdown 渲染规则与 disposable。
 *
 * 调用方应在 createEditor 内：
 * 1. 拿到 `host.extensions` 合并进 `EditorState.extensions`
 * 2. 把 `host` 透给 `EditorControl`，让 `execCommand` 优先查 plugin 命令
 * 3. 在 `EditorControl.destroy()` 内调 `host.destroy()` 反向 dispose
 */
export function createPluginHost(
  host: EditorHostCapabilities,
  plugins: readonly EditorPlugin[] | undefined,
): PluginHost {
  const state: PluginHostState = {
    commands: new Map(),
    extensions: [],
    renderers: new Map(),
    disposables: [],
    instances: [],
  };

  for (const plugin of plugins ?? []) {
    const ctx = createCtx(plugin, host, state);
    const instance = plugin.setup(ctx);
    if (instance) state.instances.push(instance);
  }

  return {
    get extensions() {
      return state.extensions;
    },
    execPluginCommand(view, id) {
      const spec = state.commands.get(id);
      if (!spec) return false;
      const sel = view.state.selection.main;
      const cmdCtx: EditorCommandContext = {
        view,
        selection: createSelectionRange(sel.anchor, sel.head),
      };
      if (spec.when && !spec.when(cmdCtx)) return true;
      const result = spec.run(cmdCtx);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        (result as Promise<unknown>).catch((err) => {
          console.error(`[editor-core] plugin command "${id}" rejected`, err);
        });
      }
      return true;
    },
    destroy() {
      for (let i = state.disposables.length - 1; i >= 0; i--) {
        try {
          state.disposables[i].dispose();
        } catch (err) {
          console.error('[editor-core] disposable dispose error', err);
        }
      }
      for (let i = state.instances.length - 1; i >= 0; i--) {
        try {
          state.instances[i].dispose?.();
        } catch (err) {
          console.error('[editor-core] plugin dispose error', err);
        }
      }
    },
  };
}

function createCtx(
  plugin: EditorPlugin,
  host: EditorHostCapabilities,
  state: PluginHostState,
): EditorPluginContext {
  const trackDisposable = (d: Disposable): Disposable => {
    state.disposables.push(d);
    return d;
  };

  return {
    host,
    registerCommands(specs) {
      const installed = new Map<string, EditorCommandSpec>();
      for (const spec of specs) {
        const prev = state.commands.get(spec.id);
        if (prev) {
          console.warn(
            `[editor-core] command "${spec.id}" registered by plugin "${plugin.id}" overrides existing registration`,
          );
        }
        state.commands.set(spec.id, spec);
        installed.set(spec.id, spec);
      }
      return trackDisposable({
        dispose() {
          for (const [id, spec] of installed) {
            if (state.commands.get(id) === spec) state.commands.delete(id);
          }
        },
      });
    },
    registerCmExtensions(extensions) {
      state.extensions.push(...extensions);
      // v0.1 不支持运行时摘除已挂载的 CM 扩展（无 Compartment）。
      // disposable 仍然返回以便未来扩充，dispose 当前为 no-op。
      return trackDisposable({ dispose() {} });
    },
    registerMarkdownRenderer(rule) {
      const prev = state.renderers.get(rule.nodeType);
      if (prev) {
        console.warn(
          `[editor-core] markdown renderer for node "${rule.nodeType}" registered by plugin "${plugin.id}" overrides existing registration`,
        );
      }
      state.renderers.set(rule.nodeType, rule);
      const exts = Array.isArray(rule.extension) ? rule.extension : [rule.extension];
      state.extensions.push(...exts);
      return trackDisposable({
        dispose() {
          if (state.renderers.get(rule.nodeType) === rule) {
            state.renderers.delete(rule.nodeType);
          }
        },
      });
    },
    // @unstable v0.1 占位：注册返回 no-op disposable，runtime 在 v0.2 落地。
    registerSlashItems() {
      return trackDisposable({ dispose() {} });
    },
    registerTrigger() {
      return trackDisposable({ dispose() {} });
    },
    on() {
      return trackDisposable({ dispose() {} });
    },
  };
}
