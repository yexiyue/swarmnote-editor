/**
 * Math Formula Rendering
 *
 * 使用 KaTeX 渲染 InlineMath ($...$) 和 BlockMath ($$...$$) 节点。
 */
import type { EditorState } from '@codemirror/state';
import { EditorView, WidgetType } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';
import type { InlineRenderingSpec, RevealStrategy } from './types';

let katexModule: typeof import('katex') | null = null;

async function loadKaTeX() {
  if (!katexModule) {
    katexModule = await import('katex');
  }
  return katexModule.default ?? katexModule;
}

class MathWidget extends WidgetType {
  constructor(
    private readonly tex: string,
    private readonly nodeFrom: number,
    private readonly nodeTo: number,
  ) {
    super();
  }

  eq(other: MathWidget) {
    return (
      this.tex === other.tex &&
      this.nodeFrom === other.nodeFrom &&
      this.nodeTo === other.nodeTo
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement('span');
    container.className = 'cm-math-inline';

    void loadKaTeX().then((katex) => {
      if (!container.isConnected) return;
      try {
        katex.render(this.tex, container, { displayMode: false, throwOnError: false });
      } catch {
        container.textContent = this.tex;
        container.classList.add('cm-math-error');
      }
    });

    // Placeholder while loading
    container.textContent = this.tex;

    // Click anywhere on the rendered formula → place caret inside (between
    // the `$` delimiters) to trigger reveal of the source.
    container.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const contentFrom = this.nodeFrom + 1;
      const contentTo = Math.max(contentFrom, this.nodeTo - 1);
      view.dispatch({
        selection: { anchor: contentFrom, head: contentTo },
        scrollIntoView: true,
      });
      view.focus();
    });

    return container;
  }

  ignoreEvent(event: Event) {
    return event.type !== 'mousedown';
  }
}

function extractInlineMath(node: SyntaxNodeRef, state: EditorState): string | null {
  if (node.name !== 'InlineMath') return null;
  // BlockMath is handled separately by `createBlockMathExtension` (block
  // decorations require a StateField; this ViewPlugin path can't provide
  // them).
  const text = state.sliceDoc(node.from, node.to);
  return text.slice(1, -1); // strip the surrounding `$`
}

export const mathTheme = EditorView.theme({
  '.cm-math-inline': {
    padding: '0 2px',
  },
  '.cm-math-block': {
    padding: '8px 0',
    textAlign: 'center',
  },
  '.cm-math-error': {
    color: 'rgba(200, 60, 60, 0.8)',
    fontStyle: 'italic',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
});

export const replaceMathFormulas: InlineRenderingSpec = {
  nodeNames: ['InlineMath'],
  extension: {
    createDecoration(node: SyntaxNodeRef, state: EditorState) {
      const tex = extractInlineMath(node, state);
      if (!tex || !tex.trim()) return null;
      return new MathWidget(tex, node.from, node.to);
    },
    getRevealStrategy(): RevealStrategy {
      return 'active';
    },
  },
};
