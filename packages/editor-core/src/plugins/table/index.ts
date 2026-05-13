/**
 * Table plugin (v0.1)
 *
 * 把 Markdown 管道表格渲染为可视化卡片，并通过 `TableContextMenu` 事件向
 * 宿主提供右键菜单交互。基于 `createBlockTableExtension`。
 */
import { createBlockTableExtension } from './renderBlockTables';
import type { EditorPlugin } from '../../types';

export interface TablePluginOptions {
  // v0.1 暂无可配置项；保留对象以便后续无破坏添加
}

export function tablePlugin(_options?: TablePluginOptions): EditorPlugin {
  return {
    id: 'table',
    setup(ctx) {
      ctx.registerCmExtensions([createBlockTableExtension()]);
    },
  };
}
