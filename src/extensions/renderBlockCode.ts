/**
 * Block-level code rendering with four interaction modes.
 *
 * `off`    — no widget, raw markdown only.
 * `inline` — fence lines (` ```lang ` / ` ``` `) collapse to header/footer
 *            widgets while code content lines stay in the CM doc flow with
 *            full syntax highlighting and direct editing. (Default.)
 * `auto`   — when the cursor is outside, the entire block collapses to a
 *            read-only "card" widget; entering reveals the raw markdown.
 * `toggle` — always renders as a card with an explicit "Code" / "Render"
 *            button per block; source visibility tracked in a state field.
 *
 * Cards in `auto`/`toggle` modes use a monospace plain-text rendering of the
 * code body — no highlight inside the widget. Users wanting full highlighting
 * either click into the block (auto) or press the "Code" button (toggle).
 */
import { syntaxTree } from '@codemirror/language';
import {
  type EditorState,
  type Extension,
  type Range,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { shouldShowSource } from '../core';
import type { CodeBlockMode } from '../types';

// ─── Helpers ────────────────────────────────────────────────────

function extractLanguage(state: EditorState, fenceLineFrom: number, fenceLineTo: number): string {
  const text = state.sliceDoc(fenceLineFrom, fenceLineTo);
  const match = text.match(/^`{3,}\s*(\S+)?/);
  return match?.[1] ?? '';
}

function extractCodeContent(state: EditorState, codeBlockFrom: number, codeBlockTo: number): string {
  const fullText = state.sliceDoc(codeBlockFrom, codeBlockTo);
  const lines = fullText.split('\n');
  if (lines.length >= 2) {
    return lines.slice(1, -1).join('\n');
  }
  return '';
}

// ─── Toggle-mode source tracking ────────────────────────────────

interface CodeBlockSourceRange {
  from: number;
  to: number;
}

export const setCodeBlockSourceMode = StateEffect.define<{
  from: number;
  to: number;
  showSource: boolean;
}>();

function codeRangesOverlap(a: CodeBlockSourceRange, b: CodeBlockSourceRange): boolean {
  return a.from <= b.to && a.to >= b.from;
}

const codeBlockSourceModeField = StateField.define<CodeBlockSourceRange[]>({
  create: () => [],
  update(ranges, tr) {
    let next = ranges.map((range) => ({
      from: tr.changes.mapPos(range.from, 1),
      to: tr.changes.mapPos(range.to, -1),
    }));

    for (const effect of tr.effects) {
      if (!effect.is(setCodeBlockSourceMode)) continue;
      const { from, to, showSource } = effect.value;
      const mapped: CodeBlockSourceRange = {
        from: tr.changes.mapPos(from, 1),
        to: tr.changes.mapPos(to, -1),
      };
      if (showSource) {
        if (!next.some((r) => codeRangesOverlap(r, mapped))) {
          next = [...next, mapped];
        }
      } else {
        next = next.filter((r) => !codeRangesOverlap(r, mapped));
      }
    }

    return next;
  },
});

function isCodeBlockInSourceMode(
  ranges: CodeBlockSourceRange[],
  from: number,
  to: number,
): boolean {
  return ranges.some((r) => r.from <= to && r.to >= from);
}

// ─── Widgets shared by inline mode (header/footer) ──────────────

function attachCopyHandler(button: HTMLButtonElement, view: EditorView, codeFrom: number, codeTo: number) {
  button.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const code = extractCodeContent(view.state, codeFrom, codeTo);
    void navigator.clipboard.writeText(code).then(() => {
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = 'Copy';
      }, 1500);
    });
  });
}

class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly codeFrom: number,
    private readonly codeTo: number,
  ) {
    super();
  }

  eq(other: CodeBlockHeaderWidget): boolean {
    return (
      this.language === other.language &&
      this.codeFrom === other.codeFrom &&
      this.codeTo === other.codeTo
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-header';

    if (this.language) {
      const label = document.createElement('span');
      label.className = 'cm-codeblock-lang';
      label.textContent = this.language;
      container.appendChild(label);
    }

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    container.appendChild(spacer);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-codeblock-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.type = 'button';
    attachCopyHandler(copyBtn, view, this.codeFrom, this.codeTo);
    container.appendChild(copyBtn);

    container.addEventListener('mousedown', (e) => {
      if (e.target === copyBtn) return;
      e.preventDefault();
      const firstCodeLine = view.state.doc.lineAt(this.codeFrom);
      const nextLine =
        firstCodeLine.number < view.state.doc.lines
          ? view.state.doc.line(firstCodeLine.number + 1)
          : firstCodeLine;
      view.dispatch({
        selection: { anchor: nextLine.from },
        scrollIntoView: true,
      });
      view.focus();
    });

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class CodeBlockFooterWidget extends WidgetType {
  eq(): boolean {
    return true;
  }

  toDOM(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-footer';
    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// ─── Card widget for auto / toggle modes ────────────────────────

class CodeBlockCardWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly code: string,
    private readonly codeFrom: number,
    private readonly codeTo: number,
    private readonly mode: 'auto' | 'toggle',
    private readonly blockFrom: number,
    private readonly blockTo: number,
  ) {
    super();
  }

  eq(other: CodeBlockCardWidget): boolean {
    return (
      this.language === other.language &&
      this.code === other.code &&
      this.codeFrom === other.codeFrom &&
      this.codeTo === other.codeTo &&
      this.mode === other.mode
    );
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-card';

    const header = document.createElement('div');
    header.className = 'cm-codeblock-header';

    if (this.language) {
      const label = document.createElement('span');
      label.className = 'cm-codeblock-lang';
      label.textContent = this.language;
      header.appendChild(label);
    }

    const spacer = document.createElement('span');
    spacer.style.flex = '1';
    header.appendChild(spacer);

    if (this.mode === 'toggle') {
      const codeBtn = document.createElement('button');
      codeBtn.className = 'cm-codeblock-toggle';
      codeBtn.textContent = 'Code';
      codeBtn.type = 'button';
      codeBtn.title = 'Show source';
      codeBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        view.dispatch({
          effects: setCodeBlockSourceMode.of({
            from: this.blockFrom,
            to: this.blockTo,
            showSource: true,
          }),
        });
      });
      header.appendChild(codeBtn);
    }

    const copyBtn = document.createElement('button');
    copyBtn.className = 'cm-codeblock-copy';
    copyBtn.textContent = 'Copy';
    copyBtn.type = 'button';
    attachCopyHandler(copyBtn, view, this.codeFrom, this.codeTo);
    header.appendChild(copyBtn);

    container.appendChild(header);

    const body = document.createElement('pre');
    body.className = 'cm-codeblock-card-body';
    body.textContent = this.code;
    container.appendChild(body);

    // auto mode: clicking body moves cursor in (so the card collapses).
    if (this.mode === 'auto') {
      body.addEventListener('mousedown', (e) => {
        if (e.target === copyBtn) return;
        e.preventDefault();
        const firstCodeLine = view.state.doc.lineAt(this.codeFrom);
        const nextLine =
          firstCodeLine.number < view.state.doc.lines
            ? view.state.doc.line(firstCodeLine.number + 1)
            : firstCodeLine;
        view.dispatch({
          selection: { anchor: nextLine.from },
          scrollIntoView: true,
        });
        view.focus();
      });
    }

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

class CodeBlockRenderToggleWidget extends WidgetType {
  constructor(
    private readonly blockFrom: number,
    private readonly blockTo: number,
  ) {
    super();
  }

  eq(other: CodeBlockRenderToggleWidget): boolean {
    return this.blockFrom === other.blockFrom && this.blockTo === other.blockTo;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-codeblock-render-toggle';

    const button = document.createElement('button');
    button.className = 'cm-codeblock-toggle';
    button.textContent = 'Render';
    button.type = 'button';
    button.title = 'Render as card';
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        effects: setCodeBlockSourceMode.of({
          from: this.blockFrom,
          to: this.blockTo,
          showSource: false,
        }),
      });
    });
    container.appendChild(button);

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// ─── Decoration builders per mode ───────────────────────────────

function pushBlockBackgroundLines(
  decorations: Range<Decoration>[],
  state: EditorState,
  fromLineFrom: number,
  blockTo: number,
) {
  for (let pos = fromLineFrom; pos <= blockTo; ) {
    const line = state.doc.lineAt(pos);
    decorations.push(Decoration.line({ class: 'cm-codeblock-line' }).range(line.from));
    pos = line.to + 1;
  }
}

function buildInlineDecorations(state: EditorState): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'FencedCode') return;

      const cursorInside = shouldShowSource(state, node.from, node.to);
      const firstLine = state.doc.lineAt(node.from);
      const lastLine = state.doc.lineAt(node.to);

      if (!cursorInside) {
        const language = extractLanguage(state, firstLine.from, firstLine.to);
        decorations.push(
          Decoration.replace({
            widget: new CodeBlockHeaderWidget(language, node.from, node.to),
            block: true,
          }).range(firstLine.from, firstLine.to),
        );

        if (lastLine.number > firstLine.number) {
          const lastLineText = state.sliceDoc(lastLine.from, lastLine.to);
          if (/^`{3,}\s*$/.test(lastLineText)) {
            decorations.push(
              Decoration.replace({
                widget: new CodeBlockFooterWidget(),
                block: true,
              }).range(lastLine.from, lastLine.to),
            );
          }
        }
      }

      pushBlockBackgroundLines(decorations, state, firstLine.from, node.to);
    },
  });

  return decorations;
}

function buildAutoDecorations(state: EditorState): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'FencedCode') return;

      const showSource = shouldShowSource(state, node.from, node.to);
      const firstLine = state.doc.lineAt(node.from);

      if (showSource) {
        // Reveal raw markdown with background only.
        pushBlockBackgroundLines(decorations, state, firstLine.from, node.to);
        return;
      }

      const language = extractLanguage(state, firstLine.from, firstLine.to);
      const code = extractCodeContent(state, node.from, node.to);
      decorations.push(
        Decoration.replace({
          widget: new CodeBlockCardWidget(
            language,
            code,
            node.from,
            node.to,
            'auto',
            node.from,
            node.to,
          ),
          block: true,
        }).range(node.from, node.to),
      );
    },
  });

  return decorations;
}

function buildToggleDecorations(
  state: EditorState,
  sourceRanges: CodeBlockSourceRange[],
): Range<Decoration>[] {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'FencedCode') return;

      const showSource = isCodeBlockInSourceMode(sourceRanges, node.from, node.to);
      const firstLine = state.doc.lineAt(node.from);

      if (showSource) {
        // Source mode: show raw markdown with a "Render" toggle widget on top.
        decorations.push(
          Decoration.widget({
            widget: new CodeBlockRenderToggleWidget(node.from, node.to),
            block: true,
            side: -1,
          }).range(node.from),
        );
        pushBlockBackgroundLines(decorations, state, firstLine.from, node.to);
        return;
      }

      const language = extractLanguage(state, firstLine.from, firstLine.to);
      const code = extractCodeContent(state, node.from, node.to);
      decorations.push(
        Decoration.replace({
          widget: new CodeBlockCardWidget(
            language,
            code,
            node.from,
            node.to,
            'toggle',
            node.from,
            node.to,
          ),
          block: true,
        }).range(node.from, node.to),
      );
    },
  });

  return decorations;
}

// ─── Field factory + theme + extension ──────────────────────────

function buildDecorations(state: EditorState, mode: CodeBlockMode): DecorationSet {
  let entries: Range<Decoration>[];
  switch (mode) {
    case 'inline':
      entries = buildInlineDecorations(state);
      break;
    case 'auto':
      entries = buildAutoDecorations(state);
      break;
    case 'toggle':
      entries = buildToggleDecorations(state, state.field(codeBlockSourceModeField));
      break;
    case 'off':
      entries = [];
      break;
  }
  return Decoration.set(
    entries.sort((a, b) => a.from - b.from),
    true,
  );
}

const codeBlockTheme = EditorView.theme({
  '.cm-codeblock-line': {
    backgroundColor: 'rgba(127, 127, 127, 0.09)',
  },
  '.cm-codeblock-header': {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '5px 14px',
    backgroundColor: 'rgba(127, 127, 127, 0.1)',
    borderRadius: '6px 6px 0 0',
    borderBottom: '1px solid rgba(127, 127, 127, 0.14)',
    fontSize: '0.82em',
    fontFamily: 'monospace',
  },
  '.cm-codeblock-lang': {
    color: 'rgba(127, 127, 127, 0.75)',
    fontWeight: '600',
    textTransform: 'lowercase',
    letterSpacing: '0.04em',
  },
  '.cm-codeblock-copy, .cm-codeblock-toggle': {
    border: '1px solid rgba(127, 127, 127, 0.22)',
    background: 'transparent',
    color: 'rgba(127, 127, 127, 0.6)',
    cursor: 'pointer',
    padding: '2px 10px',
    borderRadius: '4px',
    fontSize: '0.8em',
    fontFamily: 'inherit',
  },
  '.cm-codeblock-copy:hover, .cm-codeblock-toggle:hover': {
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    color: 'rgba(127, 127, 127, 0.9)',
  },
  '.cm-codeblock-footer': {
    height: '5px',
    backgroundColor: 'rgba(127, 127, 127, 0.1)',
    borderRadius: '0 0 6px 6px',
    borderTop: '1px solid rgba(127, 127, 127, 0.12)',
  },
  '.cm-codeblock-card': {
    border: '1px solid rgba(127, 127, 127, 0.2)',
    borderRadius: '6px',
    overflow: 'hidden',
    margin: '4px 0',
  },
  '.cm-codeblock-card-body': {
    margin: '0',
    padding: '8px 12px',
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
    fontFamily: 'monospace',
    fontSize: '0.9em',
    whiteSpace: 'pre-wrap',
    overflowX: 'auto',
    cursor: 'text',
  },
  '.cm-codeblock-render-toggle': {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '4px 12px',
  },
});

export interface BlockCodeOptions {
  mode?: CodeBlockMode;
}

export function createBlockCodeExtension(options: BlockCodeOptions = {}): Extension {
  const mode: CodeBlockMode = options.mode ?? 'inline';

  if (mode === 'off') return [];

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, mode);
    },
    update(deco, tr) {
      const hasModeToggle = tr.effects.some((e) => e.is(setCodeBlockSourceMode));
      if (tr.docChanged || tr.reconfigured || tr.selection || hasModeToggle) {
        return buildDecorations(tr.state, mode);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [codeBlockSourceModeField, codeBlockTheme, field];
}
