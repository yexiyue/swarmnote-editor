/**
 * Ctrl/Cmd+点击链接扩展
 *
 * **功能：**
 * 支持通过 Ctrl/Cmd+点击或长按（移动端）打开编辑器中的链接。
 * 
 * **交互方式：**
 * - **桌面端**：按住 Ctrl（Windows/Linux）或 Cmd（macOS）并点击链接
 * - **移动端**：长按链接 500ms 触发打开
 * 
 * **技术细节：**
 * - 监听修饰键按下/释放事件，动态添加 CSS 类显示指针样式
 * - 使用 linkUtils 查找光标位置的链接信息
 * - 调用外部回调 onLinkOpen 处理链接打开逻辑
 */
import type { Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { findLinkAtPosition } from './linkUtils';

/**
 * 修饰键 CSS 扩展
 * 
 * **功能：**
 * 监听 Control/Meta 键的按下和释放，在编辑器 DOM 上添加/移除 CSS 类。
 * 当修饰键按下时，链接会显示为可点击状态（pointer 光标）。
 * 
 * **事件处理：**
 * - keydown：按下 Control 或 Meta 时添加 `-ctrl-or-cmd-pressed` 类
 * - keyup：释放时移除该类
 * - blur：失去焦点时也移除（防止按键状态残留）
 */
const modifierKeyCssExtension = EditorView.domEventHandlers({
  keydown(event, view) {
    if (event.key === 'Control' || event.key === 'Meta') {
      view.dom.classList.add('-ctrl-or-cmd-pressed');
    }
  },
  keyup(event, view) {
    if (event.key === 'Control' || event.key === 'Meta') {
      view.dom.classList.remove('-ctrl-or-cmd-pressed');
    }
  },
  blur(_event, view) {
    view.dom.classList.remove('-ctrl-or-cmd-pressed');
  },
});

/**
 * 链接点击主题样式
 * 
 * **作用：**
 * 当修饰键按下时，URL 节点显示 pointer 光标，提示用户可点击。
 */
const linkClickTheme = EditorView.theme({
  '&.-ctrl-or-cmd-pressed .cm-url': {
    cursor: 'pointer',
  },
});

/** 链接打开回调函数类型 */
export type OnLinkOpen = (url: string) => void;

/**
 * 创建 Ctrl/Cmd+点击链接扩展
 * 
 * **工作流程：**
 * 1. 应用修饰键 CSS 扩展和主题样式
 * 2. 注册 click 事件处理器（桌面端 Ctrl/Cmd+点击）
 * 3. 注册 touchstart 事件处理器（移动端长按）
 * 
 * @param onLinkOpen - 链接打开回调函数
 * @returns CodeMirror 扩展数组
 */
export function createCtrlClickLinksExtension(
  onLinkOpen: OnLinkOpen,
): Extension {
  return [
    modifierKeyCssExtension,
    linkClickTheme,

    // Ctrl/Cmd+点击（桌面端）
    EditorView.domEventHandlers({
      /**
       * 点击事件处理器
       * 
       * @param event - 鼠标事件对象
       * @param view - 编辑器视图
       * @returns false 允许事件继续传播
       */
      click(event, view) {
        // 检查是否按下了 Ctrl 或 Cmd 键
        if (!event.ctrlKey && !event.metaKey) return false;

        // 获取点击位置对应的文档位置
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos === null) return false;

        // 查找该位置的链接
        const link = findLinkAtPosition(pos, view.state);
        if (link) {
          event.preventDefault();  // 阻止默认行为
          onLinkOpen(link.url);     // 调用回调打开链接
          return true;              // 已处理
        }
        return false;
      },
    }),

    // 长按（移动端）— 500ms 阈值
    EditorView.domEventHandlers({
      /**
       * 触摸开始事件处理器
       * 
       * **工作原理：**
       * 1. 记录触摸起始位置
       * 2. 设置 500ms 定时器
       * 3. 如果定时器触发前手指移动或抬起，取消操作
       * 4. 如果定时器触发，查找链接并打开
       * 
       * @param event - 触摸事件对象
       * @param view - 编辑器视图
       * @returns false 允许事件继续传播
       */
      touchstart(event, view) {
        // 仅处理单指触摸
        if (event.touches.length !== 1) return false;

        const touch = event.touches[0];
        const startX = touch.clientX;
        const startY = touch.clientY;

        // 创建 AbortController 用于清理事件监听器
        const controller = new AbortController();
        const { signal } = controller;

        // 设置 500ms 定时器
        const timer = setTimeout(() => {
          controller.abort();  // 清除事件监听器
          const pos = view.posAtCoords({ x: startX, y: startY });
          if (pos === null) return;

          const link = findLinkAtPosition(pos, view.state);
          if (link) {
            event.preventDefault();
            onLinkOpen(link.url);
          }
        }, 500);

        // 如果手指抬起或移动，取消定时器
        view.dom.addEventListener('touchend', () => { clearTimeout(timer); controller.abort(); }, { once: true, signal });
        view.dom.addEventListener('touchmove', () => { clearTimeout(timer); controller.abort(); }, { once: true, signal });

        return false;
      },
    }),
  ];
}
