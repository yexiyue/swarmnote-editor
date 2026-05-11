/**
 * Admonition 扩展模块导出
 * 
 * **导出内容：**
 * - createAdmonitionExtension：创建 Admonition 扩展的主函数
 * - GFM_TYPES / OBSIDIAN_TYPES：预设类型配置
 * - DEFAULT_ADMONITION_TYPE：默认回退配置
 * - 类型定义：AdmonitionTypeConfig, AdmonitionTypesMap, AdmonitionOptions
 */
export { createAdmonitionExtension, type AdmonitionOptions } from './admonitionExtension';
export { GFM_TYPES, OBSIDIAN_TYPES, DEFAULT_ADMONITION_TYPE } from './presets';
export type { AdmonitionTypeConfig, AdmonitionTypesMap } from './types';
