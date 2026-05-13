/**
 * Slash plugin (v0.1 占位)
 *
 * 注册 `id: 'slash'`、`version: '0.1.0-placeholder'`，setup 为空 —— v0.1 不实现
 * 任何 runtime（slash trigger 检测、菜单 UI 都未实现），仅占住公共 API
 * 形态，避免 v0.2 落地时引入破坏性签名变更。
 */
import type { EditorPlugin } from '../../../types';

export interface SlashPluginOptions {
  // v0.2 会在此扩充触发字符、提供方、菜单 UI 等
}

export function slashPlugin(_options?: SlashPluginOptions): EditorPlugin {
  return {
    id: 'slash',
    version: '0.1.0-placeholder',
    setup() {
      // intentionally empty — runtime deferred to v0.2
    },
  };
}
