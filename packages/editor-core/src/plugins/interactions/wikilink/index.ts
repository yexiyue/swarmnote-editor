/**
 * Wikilink plugin (v0.1 占位)
 *
 * 注册 `id: 'wikilink'`、`version: '0.1.0-placeholder'`，setup 为空 —— v0.1
 * 不识别 `[[...]]` 触发，也不查询 `host.searchNotes`。形态预留待 v0.2 落地。
 */
import type { EditorPlugin } from '../../../types';

export interface WikilinkPluginOptions {
  // v0.2 会在此扩充触发字符、候选项过滤等
}

export function wikilinkPlugin(_options?: WikilinkPluginOptions): EditorPlugin {
  return {
    id: 'wikilink',
    version: '0.1.0-placeholder',
    setup() {
      // intentionally empty — runtime deferred to v0.2
    },
  };
}
