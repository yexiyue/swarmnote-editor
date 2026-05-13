/**
 * Admonition plugin (v0.1)
 *
 * 渲染 GFM `> [!NOTE]` 与 Obsidian `> **NOTE**` 双语法的提示块。
 * 默认启用全部 GFM + Obsidian 预设类型，调用方可通过 options.types 覆盖。
 */
import { type AdmonitionOptions, createAdmonitionExtension } from './admonitionExtension';
import { GFM_TYPES, OBSIDIAN_TYPES } from './presets';
import type { EditorPlugin } from '../../types';

export type AdmonitionPluginOptions = AdmonitionOptions;

export function admonitionPlugin(options?: AdmonitionPluginOptions): EditorPlugin {
  return {
    id: 'admonition',
    setup(ctx) {
      const merged: AdmonitionOptions = {
        ...options,
        types: options?.types ?? { ...GFM_TYPES, ...OBSIDIAN_TYPES },
      };
      ctx.registerCmExtensions([createAdmonitionExtension(merged)]);
    },
  };
}
