import { Facet } from '@codemirror/state';
import type { EditorSelectionRange, SearchState, SelectionFormatting } from './types';

/**
 * 编辑器事件类型常量
 *
 * 事件按稳定性分为三层：
 *
 * - **Core**（v0.x 稳定）：`Change` / `SelectionChange` /
 *   `SelectionFormattingChange` / `Focus` / `Blur` / `SearchStateChange` /
 *   `CollaborationUpdate` / `LinkOpen`。payload 跨平台中立，不含 DOM
 *   坐标或 HTML 字符串。
 * - **Interaction** (`@unstable` v0.1)：`SlashTriggerChange` /
 *   `WikiLinkTriggerChange` / `SelectionToolbarChange`。v0.1 仅占类型，
 *   runtime 在 v0.2 落地，shape 可能调整。
 * - **Platform**（platform-coupled）：`TableContextMenu` /
 *   `MermaidZoomRequest` / `Remove`。包含 DOM 坐标 / HTML 字符串等 Web
 *   假设，非 DOM 宿主（如 React Native）下语义可能不同。
 */
export const EditorEventType = {
  /** 文档内容变化（Core） */
  Change: 'change',
  /** 选区变化（Core） */
  SelectionChange: 'selectionChange',
  /** 选区格式状态变化（Core） */
  SelectionFormattingChange: 'selectionFormattingChange',
  /** 获取焦点（Core） */
  Focus: 'focus',
  /** 失去焦点（Core） */
  Blur: 'blur',
  /** 搜索状态变化（Core） */
  SearchStateChange: 'searchStateChange',
  /** 协作更新（Core） */
  CollaborationUpdate: 'collaborationUpdate',
  /** 链接打开（Core） */
  LinkOpen: 'linkOpen',
  /**
   * Slash 触发器状态变化（Interaction, `@unstable`）。
   * v0.1 不 dispatch，runtime 在 v0.2 落地。
   */
  SlashTriggerChange: 'slashTriggerChange',
  /**
   * Wikilink 触发器状态变化（Interaction, `@unstable`）。
   * v0.1 不 dispatch，runtime 在 v0.2 落地。
   */
  WikiLinkTriggerChange: 'wikiLinkTriggerChange',
  /**
   * 选区工具栏状态变化（Interaction, `@unstable`）。
   * v0.1 不 dispatch，runtime 在 v0.2 落地。
   */
  SelectionToolbarChange: 'selectionToolbarChange',
  /** 表格右键菜单（Platform-coupled，Web/DOM 假设） */
  TableContextMenu: 'tableContextMenu',
  /** Mermaid 图表放大查看请求（Platform-coupled，含 SVG HTML 字符串） */
  MermaidZoomRequest: 'mermaidZoomRequest',
  /** 编辑器移除（Platform Convenience；非 DOM 宿主语义可能不同） */
  Remove: 'remove',
} as const;

/** 编辑器事件类型联合类型 */
export type EditorEventType = (typeof EditorEventType)[keyof typeof EditorEventType];

// ---------------------------------------------------------------------------
// Core 事件（v0.x 稳定，跨平台中立）
// ---------------------------------------------------------------------------

/** 文档内容变化事件 */
export interface EditorChangeEvent {
  kind: typeof EditorEventType.Change;
}

/** 选区变化事件 */
export interface EditorSelectionChangeEvent {
  kind: typeof EditorEventType.SelectionChange;
  /** 新的选区位置 */
  selection: EditorSelectionRange;
}

/** 获取焦点事件 */
export interface EditorFocusEvent {
  kind: typeof EditorEventType.Focus;
}

/** 失去焦点事件 */
export interface EditorBlurEvent {
  kind: typeof EditorEventType.Blur;
}

/** 搜索状态变化事件 */
export interface EditorSearchStateChangeEvent {
  kind: typeof EditorEventType.SearchStateChange;
  /** 新的搜索状态 */
  search: SearchState | null;
  /** 触发来源标识 */
  source?: string;
}

/** 协作更新事件 */
export interface EditorCollaborationUpdateEvent {
  kind: typeof EditorEventType.CollaborationUpdate;
  /** Yjs 更新数据 */
  update: Uint8Array;
}

/** 选区格式状态变化事件 */
export interface EditorSelectionFormattingChangeEvent {
  kind: typeof EditorEventType.SelectionFormattingChange;
  /** 新的格式状态 */
  formatting: SelectionFormatting;
}

/** 链接打开事件 */
export interface EditorLinkOpenEvent {
  kind: typeof EditorEventType.LinkOpen;
  /** 链接 URL */
  url: string;
}

// ---------------------------------------------------------------------------
// Interaction 事件（@unstable v0.1，runtime 延后到 v0.2）
// ---------------------------------------------------------------------------

/**
 * Slash 触发匹配。CodeMirror 位置（不含 DOM 坐标）。
 *
 * 平台 UI 负责根据 `from` / `to` 计算锚定矩形——editor-core 只暴露文档位置。
 */
export interface SlashTriggerMatch {
  /** 触发起点位置（CodeMirror Position） */
  from: number;
  /** 触发终点位置（CodeMirror Position） */
  to: number;
  /** 当前查询字符串 */
  query: string;
}

/**
 * Wikilink 触发匹配。形态与 `SlashTriggerMatch` 一致，但语义不同。
 */
export interface WikiLinkTriggerMatch {
  /** 触发起点位置（CodeMirror Position） */
  from: number;
  /** 触发终点位置（CodeMirror Position） */
  to: number;
  /** 当前查询字符串 */
  query: string;
}

/**
 * 选区工具栏状态。`anchor` / `head` 为 CM Position，不含 DOM 坐标。
 */
export interface SelectionToolbarState {
  /** 是否应当显示工具栏 */
  visible: boolean;
  /** 选区锚点（CM Position） */
  anchor: number;
  /** 选区头部（CM Position） */
  head: number;
  /** 当前选区的格式状态 */
  formatting: SelectionFormatting;
}

/**
 * @unstable v0.1 仅占类型，runtime 在 v0.2 落地。shape 可能调整。
 *
 * Slash 触发器状态变化。当 slash 触发被识别 / 取消时 dispatch。
 */
export interface EditorSlashTriggerChangeEvent {
  kind: typeof EditorEventType.SlashTriggerChange;
  /** 当前匹配；为 null 表示触发被取消 */
  match: SlashTriggerMatch | null;
}

/**
 * @unstable v0.1 仅占类型，runtime 在 v0.2 落地。shape 可能调整。
 *
 * Wikilink 触发器状态变化。
 */
export interface EditorWikiLinkTriggerChangeEvent {
  kind: typeof EditorEventType.WikiLinkTriggerChange;
  /** 当前匹配；为 null 表示触发被取消 */
  match: WikiLinkTriggerMatch | null;
}

/**
 * @unstable v0.1 仅占类型，runtime 在 v0.2 落地。shape 可能调整。
 *
 * 选区工具栏状态变化。当用户选中文本 / 取消选中时 dispatch。
 */
export interface EditorSelectionToolbarChangeEvent {
  kind: typeof EditorEventType.SelectionToolbarChange;
  /** 当前工具栏状态 */
  state: SelectionToolbarState;
}

// ---------------------------------------------------------------------------
// Platform 事件（platform-coupled，Web/DOM 假设）
// ---------------------------------------------------------------------------

/** 表格对齐方式 */
export type TableAlignment = 'left' | 'center' | 'right' | null;

/**
 * 表格上下文菜单操作接口
 *
 * 当表格 widget 触发右键菜单时，向宿主 React 层暴露的命令式操作。
 * 每个调用都会通过单次 CodeMirror dispatch 修改 Markdown 文档，
 * 让 React 菜单可以关闭而无需进一步耦合。
 */
export interface TableContextMenuActions {
  /** 在指定位置添加行 */
  addRowAt(rowIdx: number, position: 'above' | 'below'): void;
  /** 删除指定行 */
  deleteRow(rowIdx: number): void;
  /** 在指定位置添加列 */
  addColumnAt(colIdx: number, position: 'left' | 'right'): void;
  /** 删除指定列 */
  deleteColumn(colIdx: number): void;
  /** 设置列对齐方式 */
  setAlignment(colIdx: number, alignment: TableAlignment): void;
  /** 切换源码/渲染视图 */
  toggleSource(): void;
  /** 复制表格为 Markdown */
  copyMarkdown(): void;
  /** 删除整个表格 */
  deleteTable(): void;
}

/**
 * 表格右键菜单事件
 *
 * **Platform-coupled**：载荷含 DOM 像素坐标 `clientX` / `clientY`，
 * 用于 Web 宿主把菜单定位到鼠标位置。非 DOM 宿主（React Native 等）
 * 收到该事件时坐标语义未定义。
 */
export interface EditorTableContextMenuEvent {
  kind: typeof EditorEventType.TableContextMenu;
  /** 鼠标 X 坐标（DOM 像素） */
  clientX: number;
  /** 鼠标 Y 坐标（DOM 像素） */
  clientY: number;
  /** 行索引（-1 表示表头，否则为 tbody 行索引） */
  rowIdx: number;
  /** 列索引 */
  colIdx: number;
  /** 当前对齐方式 */
  alignment: TableAlignment;
  /** 总行数 */
  rowCount: number;
  /** 总列数 */
  colCount: number;
  /** 可执行的操作集合 */
  actions: TableContextMenuActions;
}

/**
 * Mermaid 图表放大查看请求事件
 *
 * **Platform-coupled**：`renderedSvg` 为已渲染的 SVG HTML 字符串，前提
 * 宿主能直接渲染 HTML 字符串到 DOM。非 DOM 宿主需要把 `source` 自行
 * 渲染为目标格式。
 */
export interface EditorMermaidZoomRequestEvent {
  kind: typeof EditorEventType.MermaidZoomRequest;
  /** Mermaid 源码字符串 */
  source: string;
  /** 已渲染的 SVG HTML 字符串（DOM 假设） */
  renderedSvg: string;
  /** 图表唯一标识符 */
  id: string;
}

/**
 * 编辑器移除事件
 *
 * **Platform-coupled**（Platform Convenience）：在 `EditorControl.destroy()`
 * 内由内核派发，主要为 Web 宿主提供「编辑器即将销毁」的便利钩子。非 DOM
 * 宿主可能不依赖此事件。
 */
export interface EditorRemoveEvent {
  kind: typeof EditorEventType.Remove;
}

// ---------------------------------------------------------------------------
// 三层 union + 聚合 union
// ---------------------------------------------------------------------------

/**
 * Core 事件 union。v0.x 稳定，载荷跨平台中立（不含 DOM 坐标 / HTML）。
 */
export type EditorCoreEvent =
  | EditorChangeEvent
  | EditorSelectionChangeEvent
  | EditorSelectionFormattingChangeEvent
  | EditorFocusEvent
  | EditorBlurEvent
  | EditorSearchStateChangeEvent
  | EditorCollaborationUpdateEvent
  | EditorLinkOpenEvent;

/**
 * Interaction 事件 union（@unstable v0.1，runtime 延后到 v0.2）。
 */
export type EditorInteractionEvent =
  | EditorSlashTriggerChangeEvent
  | EditorWikiLinkTriggerChangeEvent
  | EditorSelectionToolbarChangeEvent;

/**
 * Platform 事件 union（platform-coupled，Web/DOM 假设）。
 */
export type EditorPlatformEvent =
  | EditorTableContextMenuEvent
  | EditorMermaidZoomRequestEvent
  | EditorRemoveEvent;

/**
 * 编辑器事件聚合 union
 *
 * 等价于 `EditorCoreEvent | EditorInteractionEvent | EditorPlatformEvent`，
 * 保持与 v0.0.x 一致的整体类型形态（已存在事件 shape 不变）。
 */
export type EditorEvent =
  | EditorCoreEvent
  | EditorInteractionEvent
  | EditorPlatformEvent;

/**
 * 编辑器事件回调 Facet
 *
 * 把宿主的 `onEvent` 回调注入到 CodeMirror 状态树，供 widget / 内部扩展
 * 派发高层事件使用。`combine` 取第一个非 undefined 的回调。
 */
export const editorEventCallback = Facet.define<
  ((event: EditorEvent) => void) | undefined,
  ((event: EditorEvent) => void) | undefined
>({
  combine: (values) => values.find((v): v is (event: EditorEvent) => void => Boolean(v)),
});
