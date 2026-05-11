/**
 * 链接工具函数
 * 
 * **功能：**
 * 提供在编辑器中查找和提取链接信息的工具函数。
 */
import { syntaxTree } from '@codemirror/language';
import type { EditorState } from '@codemirror/state';

/** 链接信息接口 */
export interface LinkInfo {
  /** 链接 URL */
  url: string;
  /** 起始位置 */
  from: number;
  /** 结束位置 */
  to: number;
}

/**
 * 在指定位置查找链接
 * 
 * **工作原理：**
 * 1. 获取语法树并解析指定位置的节点栈
 * 2. 向上遍历节点栈，查找 Link 或 URL 节点
 * 3. 如果找到 Link 节点，提取其子节点 URL
 * 4. 如果直接找到 URL 节点，返回该节点信息
 * 
 * @param pos - 文档位置
 * @param state - 编辑器状态
 * @returns 链接信息，未找到返回 null
 */
export function findLinkAtPosition(pos: number, state: EditorState): LinkInfo | null {
  const tree = syntaxTree(state);
  // 解析指定位置的节点栈
  let cursor = tree.resolveStack(pos);

  // 向上遍历节点栈
  while (true) {
    // 检查是否为 Link 节点（Markdown 链接 `[text](url)`）
    if (cursor.node.name === 'Link') {
      const urlNode = cursor.node.getChild('URL');
      if (urlNode) {
        return {
          url: state.sliceDoc(urlNode.from, urlNode.to),
          from: cursor.node.from,
          to: cursor.node.to,
        };
      }
    } else if (cursor.node.name === 'URL') {
      // 直接是 URL 节点（裸链接）
      return {
        url: state.sliceDoc(cursor.node.from, cursor.node.to),
        from: cursor.node.from,
        to: cursor.node.to,
      };
    }

    // 移动到父节点
    if (!cursor.next) break;
    cursor = cursor.next;
  }

  return null;  // 未找到链接
}
