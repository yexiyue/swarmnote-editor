import type { EditorView } from '@codemirror/view';
import type { EditorEvent } from './events';

/**
 * 编辑器命令类型枚举
 * 
 * 定义了所有可通过 execCommand 执行的编辑操作。
 * 这些命令涵盖了文本格式化、插入元素、行操作、搜索等功能。
 */
export enum EditorCommandType {
  /** 撤销 */
  Undo = 'undo',
  /** 重做 */
  Redo = 'redo',
  /** 切换加粗 */
  ToggleBold = 'toggleBold',
  /** 切换斜体 */
  ToggleItalic = 'toggleItalic',
  /** 切换行内代码 */
  ToggleCode = 'toggleCode',
  /** 切换删除线 */
  ToggleStrike = 'toggleStrike',
  /** 切换高亮 */
  ToggleHighlight = 'toggleHighlight',
  /** 切换引用块 */
  ToggleBlockquote = 'toggleBlockquote',
  /** 设置标题级别 */
  ToggleHeading = 'toggleHeading',
  /** 循环切换标题级别 */
  CycleHeading = 'cycleHeading',
  /** 切换有序列表 */
  ToggleOrderedList = 'toggleOrderedList',
  /** 切换无序列表 */
  ToggleUnorderedList = 'toggleUnorderedList',
  /** 切换任务列表 */
  ToggleCheckList = 'toggleCheckList',
  /** 插入代码块 */
  InsertCodeBlock = 'insertCodeBlock',
  /** 插入水平分割线 */
  InsertHorizontalRule = 'insertHorizontalRule',
  /** 插入表格 */
  InsertTable = 'insertTable',
  /** 插入链接 */
  InsertLink = 'insertLink',
  /** 插入图片 */
  InsertImage = 'insertImage',
  /** 全选 */
  SelectAll = 'selectAll',
  /** 复制当前行 */
  DuplicateLine = 'duplicateLine',
  /** 删除当前行 */
  DeleteLine = 'deleteLine',
  /** 增加缩进 */
  IndentMore = 'indentMore',
  /** 减少缩进 */
  IndentLess = 'indentLess',
  /** 在当前行后插入新行 */
  InsertLineAfter = 'insertLineAfter',
  /** 排序选中行 */
  SortSelectedLines = 'sortSelectedLines',
  /** 跳转到哈希锚点 */
  JumpToHash = 'jumpToHash',
  /** 查找下一个 */
  FindNext = 'findNext',
  /** 查找上一个 */
  FindPrevious = 'findPrevious',
  /** 获取焦点 */
  Focus = 'focus',
  /** 失去焦点 */
  Blur = 'blur',
  /** 滚动使选区可见 */
  ScrollSelectionIntoView = 'scrollSelectionIntoView',
}

/**
 * 编辑器选区范围
 * 
 * 表示 CodeMirror 中的一个文本选区，包含起始和结束位置。
 * anchor 和 head 是 CodeMirror 的术语：
 * - anchor: 选区的固定端（用户开始选择的位置）
 * - head: 选区的活动端（用户拖动到的位置）
 * - from/to: 规范化后的起止位置（from <= to）
 */
export interface EditorSelectionRange {
  /** 选区锚点位置 */
  anchor: number;
  /** 选区头部位置 */
  head: number;
  /** 选区起始位置（较小值） */
  from: number;
  /** 选区结束位置（较大值） */
  to: number;
}

/**
 * 代码块渲染模式
 *
 * 控制代码块在编辑器中的显示和交互方式：
 *
 * - `off` - 关闭特殊渲染，仅显示原始 Markdown 语法
 * - `inline`（默认）-  fence 标记折叠为头部/尾部 widget，代码内容保持在 CM 文档流中，
 *   支持完整的语法高亮和直接编辑
 * - `auto` - 当光标不在代码块内时，整个块折叠为只读卡片；
 *   光标进入时显示原始 Markdown
 * - `toggle` - 始终显示为只读卡片；通过 "Code" / "Render" 按钮手动切换每个块的源码可见性
 */
export type CodeBlockMode = 'off' | 'inline' | 'auto' | 'toggle';

/**
 * 编辑器功能开关配置
 * 
 * 控制编辑器各个功能的启用/禁用状态。
 * 这些开关允许宿主应用根据需求定制编辑器功能。
 */
export interface EditorFeatureToggles {
  /** Markdown 语法高亮增强 */
  markdownHighlight: boolean;
  /** Markdown 装饰（如隐藏标记符号） */
  markdownDecorations: boolean;
  /** 内联渲染（实时预览 Markdown 格式） */
  inlineRendering: boolean;
  /** 块级图片渲染 */
  blockImageRendering: boolean;
  /**
   * 渲染嵌入在 Markdown 中的原生 HTML（`<img>`、`<picture>`、`<figure>`、
   * `<details>` 等），通过 DOMPurify 进行安全净化。默认为 true。
   */
  rawHtmlRendering: boolean;
  /** 代码块渲染模式 */
  codeBlockMode: CodeBlockMode;
  /** 数学公式渲染（KaTeX） */
  mathRendering: boolean;
  /** 搜索功能 */
  search: boolean;
  /** 协作编辑（Yjs） */
  collaboration: boolean;
  /** URL 粘贴转换为链接以及文件拖拽上传。默认为 true。 */
  smartPaste: boolean;
  /** Admonition / 提示块渲染（`> [!note]` 等）。默认为 true。 */
  admonition: boolean;
}

/** 编辑器外观主题 */
export type EditorAppearance = 'light' | 'dark';

/**
 * 编辑器主题配置
 * 
 * 定义编辑器的视觉样式，包括颜色、字体等。
 */
export interface EditorThemeConfig {
  /** 外观（亮色/暗色） */
  appearance: EditorAppearance;
  /** 字体族 */
  fontFamily?: string;
  /** 字体大小（像素） */
  fontSize?: number;
  /** 颜色配置 */
  colors?: {
    /** 背景色 */
    background?: string;
    /** 前景色（文本颜色） */
    foreground?: string;
    /** 选区背景色 */
    selection?: string;
    /** 当前行高亮色 */
    activeLine?: string;
    /** 边框颜色 */
    border?: string;
    /** 代码块背景色 */
    codeBackground?: string;
    /** 标题颜色 */
    heading?: string;
    /** 链接颜色 */
    link?: string;
    /** 注释颜色 */
    comment?: string;
    /** 关键字颜色 */
    keyword?: string;
    /** 字符串颜色 */
    string?: string;
  };
}

/**
 * 编辑器设置
 * 
 * 包含编辑器的所有配置选项，分为基础设置、功能开关和主题配置。
 */
export interface EditorSettings {
  /** 只读模式 */
  readonly: boolean;
  /** 自动换行 */
  lineWrapping: boolean;
  /** 使用 Tab 字符缩进（而非空格） */
  indentWithTabs: boolean;
  /** Tab 宽度（空格数） */
  tabSize: number;
  /** 自动获取焦点 */
  autofocus: boolean;
  /** 拼写检查 */
  spellcheck: boolean;
  /** 可编辑状态 */
  editable: boolean;
  /** 显示行号 */
  showLineNumbers: boolean;
  /** 功能开关 */
  features: EditorFeatureToggles;
  /** 主题配置 */
  theme: EditorThemeConfig;
}

/**
 * 编辑器设置更新接口
 * 
 * 用于部分更新编辑器设置。features 和 theme 也可以部分更新。
 * 这种设计允许宿主应用只修改需要改变的配置项。
 */
export interface EditorSettingsUpdate
  extends Partial<Omit<EditorSettings, 'features' | 'theme'>> {
  /** 部分功能开关更新 */
  features?: Partial<EditorFeatureToggles>;
  /** 部分主题配置更新 */
  theme?: Partial<EditorThemeConfig>;
}

/**
 * 搜索状态
 * 
 * 表示搜索面板的当前状态，包括搜索关键词、选项和匹配结果信息。
 */
export interface SearchState {
  /** 搜索关键词 */
  query: string;
  /** 替换关键词 */
  replaceQuery: string;
  /** 区分大小写 */
  caseSensitive: boolean;
  /** 全字匹配 */
  wholeWord: boolean;
  /** 使用正则表达式 */
  regexp: boolean;
  /** 搜索面板是否打开 */
  isOpen: boolean;
  /** 当前激活的匹配项索引（从 0 开始） */
  activeMatchIndex: number | null;
  /** 总匹配数 */
  totalMatches: number;
}

/**
 * 编辑器协作配置
 * 
 * 配置 Yjs CRDT 协作编辑所需的参数。
 */
export interface EditorCollaborationConfig {
  /** Yjs 文档实例 */
  ydoc: unknown;
  /** 片段名称（默认为 'document'） */
  fragmentName?: string;
  /** 本地操作来源标识 */
  localOrigin?: string;
  /** 远程操作来源标识 */
  remoteOrigin?: string;
  /**
   * 可选的 `Awareness` 实例（来自 `y-protocols/awareness`），绑定到与
   * `ydoc` 相同的 Y.Doc。提供时，编辑器会通过 `yCollab(ytext, awareness)`
   * 连接它，使 `y-codemirror.next` 能够渲染远程光标和用户名标签。
   * 
   * 生命周期管理（创建、`setLocalState`、销毁、网络推送/应用）由调用者负责——
   * 编辑器只读取它。使用 `unknown` 类型以避免在此处硬依赖 `y-protocols`。
   */
  awareness?: unknown;
}

/**
 * 编辑器属性（创建编辑器时的配置）
 * 
 * 传递给 createEditor 函数的完整配置对象。
 */
export interface EditorProps {
  /** 初始文本内容 */
  initialText: string;
  /** 初始选区位置 */
  initialSelection?: EditorSelectionRange;
  /** 编辑器设置 */
  settings: EditorSettings;
  /** 初始搜索状态 */
  initialSearchState?: SearchState | null;
  /** 是否自动获取焦点 */
  autofocus?: boolean;
  /** 协作编辑配置 */
  collaboration?: EditorCollaborationConfig;
  /** 事件回调函数 */
  onEvent?: (event: EditorEvent) => void;
  /**
   * 可选的图片 URL 解析器。接收 Markdown 源中的原始 `src` 字符串，
   * 返回实际赋值给 `<img src>` 的 URL。适用于将工作区相对路径映射到
   * 平台特定协议（如 Tauri 的 `asset://`）。
   *
   * 解析器可以返回 Promise。在解析完成前，widget 会渲染为无 src 状态
   * （仅占位高度）。如果拒绝或加载错误，widget 会使用退避策略重试最多 3 次，
   * 然后显示回退内容。
   */
  imageResolver?: (src: string) => string | Promise<string>;
  /**
   * 可选的文件上传处理函数，当用户拖拽文件到编辑器时调用。
   * 接收一个 `File` 对象，返回 URL 和可选的 alt 文本，
   * 这些内容将以 `![alt](url)` Markdown 格式插入到拖拽位置。
   * 如果省略，文件拖拽会被 preventDefault 并静默忽略。
   */
  uploadFile?: (file: File) => Promise<{ url: string; alt?: string }>;
}

/**
 * 编辑器控制器接口
 * 
 * 这是外部宿主应用与编辑器交互的主要接口。
 * 提供了文本操作、选区管理、设置更新、搜索控制等功能。
 */
export interface EditorControl {
  /** CodeMirror 6 编辑器视图（只读） */
  readonly view: EditorView;

  /** 检查是否支持指定命令 */
  supportsCommand(name: EditorCommandType | string): boolean;
  /** 执行指定命令 */
  execCommand(name: EditorCommandType | string, ...args: unknown[]): unknown;

  /** 获取全文 */
  getText(): string;
  /** 设置全文 */
  setText(text: string): void;
  /** 插入文本 */
  insertText(text: string): void;
  /** 替换选区 */
  replaceSelection(text: string): void;

  /** 获取当前选区 */
  getSelection(): EditorSelectionRange;
  /** 设置选区 */
  select(anchor: number, head?: number): void;

  /** 获取编辑器设置 */
  getSettings(): EditorSettings;
  /** 更新编辑器设置 */
  updateSettings(settings: EditorSettingsUpdate): void;

  /** 获取搜索状态 */
  getSearchState(): SearchState | null;
  /** 设置搜索状态 */
  setSearchState(state: SearchState | null, source?: string): void;
  /** 清除搜索 */
  clearSearch(source?: string): void;

  /** 获取选区格式状态 */
  getSelectionFormatting(): SelectionFormatting;

  /**
   * 设置覆盖编辑器底部的 UI 元素的高度（像素）。
   * 
   * 原子性地驱动两个配置：
   * - `scrollMargins.bottom` - 自动 scrollIntoView 时光标会停留在遮挡物上方
   * - `.cm-content` padding-bottom - 用户可以手动滚动最后几行经过遮挡物
   * 
   * 传入 0 禁用此功能。当遮挡物高度变化时调用。
   */
  setScrollBottomMargin(px: number): void;

  /** 获取焦点 */
  focus(): void;
  /** 失去焦点 */
  blur(): void;
  /** 销毁编辑器 */
  destroy(): void;
}

/** 列表类型 */
export type ListType = 'ordered' | 'unordered' | 'check';

/**
 * 选区格式状态
 * 
 * 描述当前选区或光标位置的格式状态，用于工具栏按钮的状态显示。
 * 例如：如果 bold 为 true，则加粗按钮应该显示为激活状态。
 */
export interface SelectionFormatting {
  /** 是否加粗 */
  bold: boolean;
  /** 是否斜体 */
  italic: boolean;
  /** 是否行内代码 */
  code: boolean;
  /** 是否删除线 */
  strikethrough: boolean;
  /** 是否高亮 */
  highlight: boolean;
  /** 标题级别（0 表示非标题） */
  heading: number;
  /** 列表类型 */
  listType: ListType | null;
  /** 列表层级 */
  listLevel: number;
  /** 是否在引用块中 */
  inBlockquote: boolean;
  /** 是否在代码块中 */
  inCodeBlock: boolean;
}

export const DEFAULT_SELECTION_FORMATTING: SelectionFormatting = {
  bold: false,
  italic: false,
  code: false,
  strikethrough: false,
  highlight: false,
  heading: 0,
  listType: null,
  listLevel: 0,
  inBlockquote: false,
  inCodeBlock: false,
};

export const DEFAULT_SEARCH_STATE: SearchState = {
  query: '',
  replaceQuery: '',
  caseSensitive: false,
  wholeWord: false,
  regexp: false,
  isOpen: false,
  activeMatchIndex: null,
  totalMatches: 0,
};

export const DEFAULT_THEME: EditorThemeConfig = {
  appearance: 'light',
};

export const DEFAULT_SETTINGS: EditorSettings = {
  readonly: false,
  lineWrapping: true,
  indentWithTabs: false,
  tabSize: 2,
  autofocus: false,
  spellcheck: false,
  editable: true,
  showLineNumbers: false,
  theme: DEFAULT_THEME,
  features: {
    markdownHighlight: true,
    markdownDecorations: true,
    inlineRendering: true,
    blockImageRendering: true,
    rawHtmlRendering: true,
    codeBlockMode: 'inline',
    mathRendering: true,
    search: true,
    collaboration: true,
    smartPaste: true,
    admonition: true,
  },
};
