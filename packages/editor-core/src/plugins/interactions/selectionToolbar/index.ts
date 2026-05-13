/**
 * Selection toolbar plugin (v0.1 占位)
 *
 * 注册 `id: 'selectionToolbar'`、`version: '0.1.0-placeholder'`，setup 为空 ——
 * v0.1 不监听选区变化也不派发 `selectionToolbarChange` 事件。形态预留待 v0.2 落地。
 */
import type { EditorPlugin } from '../../../types';

export interface SelectionToolbarPluginOptions {
  // v0.2 会在此扩充触发条件、防抖间隔等
}

export function selectionToolbarPlugin(
  _options?: SelectionToolbarPluginOptions,
): EditorPlugin {
  return {
    id: 'selectionToolbar',
    version: '0.1.0-placeholder',
    setup() {
      // intentionally empty — runtime deferred to v0.2
    },
  };
}
