/**
 * Block-level math rendering via KaTeX.
 *
 * BlockMath nodes (`$$...$$` spanning multiple lines) require **block**
 * decorations, which CodeMirror only accepts from a StateField — the inline
 * `replaceMathFormulas` spec runs inside a ViewPlugin and silently fails for
 * cross-line widgets, so block math goes through this dedicated extension.
 *
 * Inline math (`$...$`) is still handled by `replaceMathFormulas` since it
 * stays on a single line.
 */
import { ensureSyntaxTree } from '@codemirror/language';
import {
  type EditorState,
  type Extension,
  RangeSetBuilder,
  StateField,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
} from '@codemirror/view';
// KaTeX ships its own stylesheet; without it the MathML <annotation> falls
// out of its `position: absolute; clip` hiding rule and renders alongside
// the visible KaTeX output (showing both the rendered formula and the raw
// LaTeX source on the same line).
import 'katex/dist/katex.css';

let katexModule: typeof import('katex') | null = null;

async function loadKaTeX() {
  if (!katexModule) {
    katexModule = await import('katex');
  }
  return katexModule.default ?? katexModule;
}

class BlockMathWidget extends WidgetType {
  // contentFrom / contentTo describe the LaTeX content range (excluding the
  // surrounding `$$` delimiter lines). Click on the card selects exactly this
  // region — matches Obsidian's "select only the formula body" behaviour.
  constructor(
    private readonly tex: string,
    private readonly contentFrom: number,
    private readonly contentTo: number,
  ) {
    super();
  }

  eq(other: BlockMathWidget) {
    return (
      other.tex === this.tex &&
      other.contentFrom === this.contentFrom &&
      other.contentTo === this.contentTo
    );
  }

  toDOM(view: EditorView) {
    const card = document.createElement('div');
    card.className = 'cm-math-block-card';

    const formula = document.createElement('div');
    formula.className = 'cm-math-block';
    formula.textContent = this.tex;

    const editBtn = document.createElement('button');
    editBtn.className = 'cm-math-block-edit';
    editBtn.type = 'button';
    editBtn.title = '编辑源码';
    // Lucide `code-2` icon — kept inline to avoid pulling lucide-react into
    // the editor submodule.
    editBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>';

    card.appendChild(formula);
    card.appendChild(editBtn);

    void loadKaTeX().then((katex) => {
      if (!formula.isConnected) return;
      try {
        formula.textContent = '';
        katex.render(this.tex, formula, { displayMode: true, throwOnError: false });
      } catch {
        formula.textContent = this.tex;
        formula.classList.add('cm-math-error');
      }
    });

    const enterSource = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        selection: { anchor: this.contentFrom, head: this.contentTo },
        scrollIntoView: true,
      });
      view.focus();
    };

    editBtn.addEventListener('mousedown', enterSource);
    card.addEventListener('mousedown', enterSource);

    return card;
  }

  ignoreEvent(event: Event) {
    // Let our mousedown handler run; ignore everything else so CM doesn't
    // reposition the caret based on widget clicks.
    return event.type !== 'mousedown';
  }
}

function buildBlockMathDecorations(state: EditorState): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = ensureSyntaxTree(state, state.doc.length, 100);
  if (!tree) return builder.finish();

  const sel = state.selection.main;
  const cursorLine = state.doc.lineAt(sel.head).number;

  tree.iterate({
    enter(node) {
      if (node.name !== 'BlockMath') return;
      const fromLine = state.doc.lineAt(node.from).number;
      const toLine = state.doc.lineAt(node.to).number;
      const selFromLine = state.doc.lineAt(sel.from).number;
      const selToLine = state.doc.lineAt(sel.to).number;
      const intersects =
        (cursorLine >= fromLine && cursorLine <= toLine) ||
        (selFromLine <= toLine && selToLine >= fromLine);

      const text = state.sliceDoc(node.from, node.to);
      const startMatch = text.match(/^\$\$\s*/);
      const endMatch = text.match(/\s*\$\$$/);
      const startLen = startMatch?.[0].length ?? 2;
      const endLen = endMatch?.[0].length ?? 2;
      const contentFrom = node.from + startLen;
      const contentTo = Math.max(contentFrom, node.to - endLen);
      const inner = text.slice(startLen, text.length - endLen).trim();
      if (!inner) return;

      const widget = new BlockMathWidget(inner, contentFrom, contentTo);

      if (intersects) {
        // Cursor in block → keep source visible AND show rendered preview
        // immediately after the closing `$$` line. side:1 places it after.
        builder.add(node.to, node.to, Decoration.widget({ widget, block: true, side: 1 }));
      } else {
        // Cursor out → replace whole block with the rendered card.
        builder.add(node.from, node.to, Decoration.replace({ widget, block: true }));
      }
    },
  });

  return builder.finish();
}

const blockMathField = StateField.define<DecorationSet>({
  create: (state) => buildBlockMathDecorations(state),
  update(prev, tr) {
    if (tr.docChanged || tr.selection) {
      return buildBlockMathDecorations(tr.state);
    }
    return prev;
  },
  provide: (f) => EditorView.decorations.from(f),
});

const blockMathTheme = EditorView.theme({
  '.cm-math-block-card': {
    position: 'relative',
    border: '1px solid transparent',
    borderRadius: '6px',
    margin: '8px 0',
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'border-color 0.12s ease, background-color 0.12s ease',
  },
  '.cm-math-block-card:hover': {
    borderColor: 'rgba(127, 127, 127, 0.25)',
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
  },
  '.cm-math-block': {
    textAlign: 'center',
  },
  '.cm-math-block-edit': {
    position: 'absolute',
    top: '6px',
    right: '8px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    color: 'rgba(127, 127, 127, 0.7)',
    padding: '4px',
    borderRadius: '4px',
    opacity: '0',
    transition: 'opacity 0.12s ease, background-color 0.12s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '0',
  },
  '.cm-math-block-card:hover .cm-math-block-edit': {
    opacity: '1',
  },
  '.cm-math-block-edit:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.15)',
  },
  '.cm-math-error': {
    color: 'rgba(200, 60, 60, 0.85)',
    fontStyle: 'italic',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
});

export function createBlockMathExtension(): Extension {
  return [blockMathField, blockMathTheme];
}
