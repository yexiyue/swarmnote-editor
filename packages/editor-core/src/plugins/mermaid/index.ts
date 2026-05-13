/**
 * Mermaid plugin (v0.1)
 *
 * 把 ```mermaid fenced 代码块渲染为 SVG 卡片。基于 `createBlockMermaidExtension`。
 */
import {
  type BlockMermaidOptions,
  createBlockMermaidExtension,
} from './renderBlockMermaid';
import type { EditorPlugin } from '../../types';

export type MermaidPluginOptions = BlockMermaidOptions;

export function mermaidPlugin(options?: MermaidPluginOptions): EditorPlugin {
  return {
    id: 'mermaid',
    setup(ctx) {
      ctx.registerCmExtensions([createBlockMermaidExtension(options)]);
    },
  };
}
