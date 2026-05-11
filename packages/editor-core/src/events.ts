import { Facet } from '@codemirror/state';
import type { EditorSelectionRange, SearchState, SelectionFormatting } from './types';

/**
 * 编辑器事件类型常量
 * 
 * 定义了编辑器向外触发的所有事件类型。
 * 宿主应用通过 onEvent 回调接收这些事件，实现与编辑器的解耦通信。
 */
export const EditorEventType = {
  /** 文档内容变化 */
  Change: 'change',
  /** 选区变化 */
  SelectionChange: 'selectionChange',
  /** 选区格式状态变化 */
  SelectionFormattingChange: 'selectionFormattingChange',
  /** 获取焦点 */
  Focus: 'focus',
  /** 失去焦点 */
  Blur: 'blur',
  /** 搜索状态变化 */
  SearchStateChange: 'searchStateChange',
  /** 协作更新 */
  CollaborationUpdate: 'collaborationUpdate',
  /** 链接打开 */
  LinkOpen: 'linkOpen',
  /** 编辑器移除 */
  Remove: 'remove',
  /** 表格右键菜单 */
  TableContextMenu: 'tableContextMenu',
} as const;

/** 编辑器事件类型联合类型 */
export type EditorEventType = (typeof EditorEventType)[keyof typeof EditorEventType];

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

/** 编辑器移除事件 */
export interface EditorRemoveEvent {
  kind: typeof EditorEventType.Remove;
}

/** 表格对齐方式 */
export type TableAlignment = 'left' | 'center' | 'right' | null;

/**
 * 表格上下文菜单操作接口
 * 
 * 当表格 widget 触发右键菜单时，向宿主 React 层暴露的命令式操作。
 * 每个调用都会通过单次 CodeMirror dispatch 修改 Markdown 文档，
 * 让 React 菜单可以关闭而无需进一步耦合。
 * 
 * 这种设计实现了编辑器和 UI 层的解耦：
 * - 编辑器只负责提供操作能力
 * - React 层负责渲染菜单和处理用户交互
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

/** 表格右键菜单事件 */
export interface EditorTableContextMenuEvent {
  kind: typeof EditorEventType.TableContextMenu;
  /** 鼠标 X 坐标 */
  clientX: number;
  /** 鼠标 Y 坐标 */
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
 * 编辑器事件联合类型
 * 
 * 所有可能的编辑器事件的并集，用于 TypeScript 的类型收窄。
 */
export type EditorEvent =
  | EditorChangeEvent
  | EditorSelectionChangeEvent
  | EditorSelectionFormattingChangeEvent
  | EditorFocusEvent
  | EditorBlurEvent
  | EditorSearchStateChangeEvent
  | EditorCollaborationUpdateEvent
  | EditorLinkOpenEvent
  | EditorRemoveEvent
  | EditorTableContextMenuEvent;

/**
 * 编辑器事件回调 Facet
 * 
 * 这是一个 CodeMirror Facet，将宿主的 `onEvent` 回调传递到 CodeMirror 状态树中。
 * 
 * **为什么需要这个 Facet？**
 * 
 * Widget（如表格、代码块等）运行在 StateField 内部，只能访问 `view` 引用，
 * 无法直接访问 createEditor 时传入的 `onEvent` 回调。通过这个 Facet，
 * widget 可以向 React 层派发高层事件，而无需扩大 widget 的公开接口表面。
 * 
 * **工作原理：**
 * 1. 在 createEditor 中，将 onEvent 注册到这个 Facet
 * 2. Widget 通过 `view.state.facet(editorEventCallback)` 获取回调
 * 3. Widget 调用回调函数派发事件
 * 
 * **combine 函数说明：**
 * 从多个值中找到第一个非 undefined 的回调函数。
 * Facet 可能被多次配置，但我们只需要一个有效的回调。
 */
export const editorEventCallback = Facet.define<
  ((event: EditorEvent) => void) | undefined,
  ((event: EditorEvent) => void) | undefined
>({
  combine: (values) => values.find((v): v is (event: EditorEvent) => void => Boolean(v)),
});
