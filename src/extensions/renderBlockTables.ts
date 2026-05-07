/**
 * Live-preview rendering of GFM markdown tables (Obsidian-style).
 *
 * Two display modes per-table, switchable via the cell context menu:
 * - widget mode (default) — `EditableTableWidget` with contentEditable cells
 * - source mode — raw markdown lines with a "Table" toggle widget at the top
 *
 * UI is a pure grid by default. On hover/focus only two handles surface:
 *   1. per-row `:::` handle in the left gutter (click toggles row highlight)
 *   2. per-column `:::` handle above the header (click toggles column highlight)
 *
 * All structural edits (add/remove row+column, alignment, source toggle,
 * copy, delete) live in a context menu rendered by the host React layer.
 * Right-clicking any cell raises an `EditorTableContextMenu` event that
 * carries the cell coordinates and a bag of imperative `actions`. The host
 * (`NoteEditor`) then renders a shadcn `DropdownMenu` at the click position;
 * this submodule never paints menu DOM itself.
 *
 * Cell editing uses on-blur / on-Enter commit (NOT onInput) to keep IME
 * composition uninterrupted and produce single Yjs deltas per edit.
 *
 * Theme colors come from CSS variables `--cm-table-*` defined in
 * `createTheme.ts`; this module never hardcodes rgba.
 */
import { syntaxTree } from '@codemirror/language';
import {
  type EditorState,
  type Range,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { editorEventCallback, EditorEventType, type TableContextMenuActions } from '../events';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';

// KaTeX is lazy-loaded the first time a table cell contains inline math; the
// CSS is already imported globally by `renderBlockMath.ts`.
let katexModule: typeof import('katex') | null = null;
function loadKaTeX(): Promise<typeof import('katex').default> {
  if (katexModule) {
    const mod = katexModule as { default?: typeof import('katex').default };
    return Promise.resolve(mod.default ?? (katexModule as unknown as typeof import('katex').default));
  }
  return import('katex').then((m) => {
    katexModule = m;
    const mod = m as { default?: typeof import('katex').default };
    return mod.default ?? (m as unknown as typeof import('katex').default);
  });
}

/**
 * Replace each `<span class="cm-table-math" data-tex="...">$x$</span>`
 * placeholder produced by `renderInlineMarkdown` with a KaTeX-rendered
 * inline formula. Failures fall back to the literal source text.
 */
function hydrateMathSpans(root: HTMLElement) {
  const spans = root.querySelectorAll<HTMLElement>('.cm-table-math[data-tex]');
  if (spans.length === 0) return;
  void loadKaTeX().then((katex) => {
    spans.forEach((span) => {
      if (!span.isConnected) return;
      const tex = span.dataset.tex ?? '';
      try {
        katex.render(tex, span, { displayMode: false, throwOnError: false });
        span.removeAttribute('data-tex');
      } catch {
        span.textContent = `$${tex}$`;
      }
    });
  });
}

// ─── Types ──────────────────────────────────────────────────────

type Alignment = 'left' | 'center' | 'right' | null;

interface TableData {
  headers: string[];
  alignments: Alignment[];
  rows: string[][];
}

interface TableSourceRange {
  from: number;
  to: number;
}

// ─── Markdown Parsing ───────────────────────────────────────────

function parseRow(line: string): string[] {
  const placeholder = '\x00PIPE\x00';
  const escaped = line.replace(/\\\|/g, placeholder);
  const cells = escaped.split('|');

  if (cells.length > 0 && cells[0].trim() === '') cells.shift();
  if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();

  return cells.map((cell) => cell.replace(new RegExp(placeholder, 'g'), '|').trim());
}

function parseAlignment(cell: string): Alignment {
  const trimmed = cell.trim();
  const left = trimmed.startsWith(':');
  const right = trimmed.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return null;
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

function parseMarkdownTable(source: string): TableData | null {
  const lines = source.split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) return null;

  const headerCells = parseRow(lines[0]);
  if (headerCells.length === 0) return null;

  const separatorCells = parseRow(lines[1]);
  if (!isSeparatorRow(separatorCells)) return null;
  if (headerCells.length !== separatorCells.length) return null;

  const alignments = separatorCells.map(parseAlignment);

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rowCells = parseRow(lines[i]);
    rows.push(headerCells.map((_, idx) => rowCells[idx] ?? ''));
  }

  return { headers: headerCells, alignments, rows };
}

// ─── Markdown Generation ────────────────────────────────────────

function generateSeparator(alignment: Alignment): string {
  switch (alignment) {
    case 'left':
      return ':---';
    case 'right':
      return '---:';
    case 'center':
      return ':---:';
    default:
      return '---';
  }
}

function serializeMarkdownTable(data: TableData): string {
  const headerLine = `| ${data.headers.join(' | ')} |`;
  const sepLine = `| ${data.alignments.map(generateSeparator).join(' | ')} |`;
  const dataLines = data.rows.map((row) => `| ${row.join(' | ')} |`);
  return [headerLine, sepLine, ...dataLines].join('\n');
}

function cloneTableData(data: TableData): TableData {
  return {
    headers: [...data.headers],
    alignments: [...data.alignments],
    rows: data.rows.map((row) => [...row]),
  };
}

// ─── Source mode tracking ───────────────────────────────────────

export const setTableSourceMode = StateEffect.define<{
  from: number;
  to: number;
  showSource: boolean;
}>();

function rangesOverlap(a: TableSourceRange, b: TableSourceRange): boolean {
  return a.from <= b.to && a.to >= b.from;
}

const tableSourceModeField = StateField.define<TableSourceRange[]>({
  create: () => [],
  update(ranges, tr) {
    let next = ranges.map((range) => ({
      from: tr.changes.mapPos(range.from, 1),
      to: tr.changes.mapPos(range.to, -1),
    }));

    for (const effect of tr.effects) {
      if (!effect.is(setTableSourceMode)) continue;
      const { from, to, showSource } = effect.value;
      const mapped: TableSourceRange = {
        from: tr.changes.mapPos(from, 1),
        to: tr.changes.mapPos(to, -1),
      };
      if (showSource) {
        if (!next.some((r) => rangesOverlap(r, mapped))) {
          next = [...next, mapped];
        }
      } else {
        next = next.filter((r) => !rangesOverlap(r, mapped));
      }
    }

    return next;
  },
});

function isTableInSourceMode(ranges: TableSourceRange[], from: number, to: number): boolean {
  return ranges.some((r) => r.from <= to && r.to >= from);
}

// ─── Lucide icons (inlined SVG) ─────────────────────────────────

type IconKey = 'grip-horizontal' | 'grip-vertical' | 'table';

const SVG_PROLOGUE =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

const LUCIDE_ICONS: Record<IconKey, string> = {
  'grip-horizontal':
    `${SVG_PROLOGUE}<circle cx="12" cy="9" r="1"/><circle cx="19" cy="9" r="1"/><circle cx="5" cy="9" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="19" cy="15" r="1"/><circle cx="5" cy="15" r="1"/></svg>`,
  'grip-vertical':
    `${SVG_PROLOGUE}<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>`,
  table: `${SVG_PROLOGUE}<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></svg>`,
};

function iconButton(
  iconKey: IconKey,
  title: string,
  onClick: () => void,
  className: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.title = title;
  btn.setAttribute('aria-label', title);
  btn.innerHTML = LUCIDE_ICONS[iconKey];
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });
  return btn;
}

// ─── Pending focus across widget rebuilds ───────────────────────

const pendingTableFocus = new Map<number, { row: number; col: number }>();

// ─── Editable Table Widget ──────────────────────────────────────

class EditableTableWidget extends WidgetType {
  constructor(
    private readonly data: TableData,
    private readonly tableFrom: number,
    private readonly tableTo: number,
  ) {
    super();
  }

  eq(other: EditableTableWidget): boolean {
    if (this.tableFrom !== other.tableFrom || this.tableTo !== other.tableTo) return false;
    if (this.data.headers.length !== other.data.headers.length) return false;
    if (this.data.rows.length !== other.data.rows.length) return false;
    for (let i = 0; i < this.data.headers.length; i++) {
      if (this.data.headers[i] !== other.data.headers[i]) return false;
      if (this.data.alignments[i] !== other.data.alignments[i]) return false;
    }
    for (let i = 0; i < this.data.rows.length; i++) {
      for (let j = 0; j < this.data.headers.length; j++) {
        if (this.data.rows[i][j] !== other.data.rows[i][j]) return false;
      }
    }
    return true;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-table-widget';
    container.dataset.tableFrom = String(this.tableFrom);

    container.appendChild(this.buildTable(view));

    const pending = pendingTableFocus.get(this.tableFrom);
    if (pending) {
      pendingTableFocus.delete(this.tableFrom);
      requestAnimationFrame(() => {
        const targetRow =
          pending.row === -1
            ? container.querySelector<HTMLTableRowElement>('thead tr')
            : container.querySelectorAll<HTMLTableRowElement>('tbody tr')[pending.row];
        if (!targetRow) return;
        const cells = targetRow.querySelectorAll<HTMLElement>(
          'th[contenteditable], td[contenteditable]',
        );
        const target = cells[pending.col];
        if (target) focusCellEnd(target);
      });
    }

    return container;
  }

  // Widget cells are contentEditable and manage their own DOM events
  // (focus / caret / typing). Returning true tells CodeMirror not to move
  // its own selection in response to events that originate inside the
  // widget — without this, clicking a cell would push the editor caret to
  // the widget boundary instead of focusing the cell.
  ignoreEvent(): boolean {
    return true;
  }

  // ── Table body ──

  private buildTable(view: EditorView): HTMLElement {
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.data.headers.forEach((header, colIdx) => {
      const th = this.createCell(view, 'th', header, colIdx, (next) =>
        this.commitHeader(view, colIdx, next),
      );
      th.appendChild(this.buildColumnHandle(colIdx));
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.data.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      tr.dataset.rowIdx = String(rowIdx);
      row.forEach((cell, colIdx) => {
        const td = this.createCell(view, 'td', cell, colIdx, (next) =>
          this.commitCell(view, rowIdx, colIdx, next),
        );
        if (colIdx === 0) {
          td.appendChild(this.buildRowHandle(rowIdx));
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  private buildRowHandle(rowIdx: number): HTMLElement {
    return iconButton(
      'grip-vertical',
      'Click to select row',
      () => this.toggleRowSelection(rowIdx),
      'cm-table-row-handle',
    );
  }

  private buildColumnHandle(colIdx: number): HTMLElement {
    return iconButton(
      'grip-horizontal',
      'Click to select column',
      () => this.toggleColumnSelection(colIdx),
      'cm-table-col-handle',
    );
  }

  // ── Selection helpers ──

  private toggleRowSelection(rowIdx: number) {
    const widgetEl = document.querySelector<HTMLElement>(
      `.cm-table-widget[data-table-from="${this.tableFrom}"]`,
    );
    if (!widgetEl) return;
    const rows = widgetEl.querySelectorAll<HTMLTableRowElement>('tbody tr');
    const target = rows[rowIdx];
    if (!target) return;
    const wasSelected = widgetEl.dataset.selectedRow === String(rowIdx);
    clearTableSelection(widgetEl);
    if (!wasSelected) {
      target.classList.add('cm-table-row-selected');
      widgetEl.dataset.selectedRow = String(rowIdx);
    }
  }

  private toggleColumnSelection(colIdx: number) {
    const widgetEl = document.querySelector<HTMLElement>(
      `.cm-table-widget[data-table-from="${this.tableFrom}"]`,
    );
    if (!widgetEl) return;
    const wasSelected = widgetEl.dataset.selectedCol === String(colIdx);
    clearTableSelection(widgetEl);
    if (!wasSelected) {
      const headerTh = widgetEl.querySelectorAll<HTMLElement>('thead th')[colIdx];
      headerTh?.classList.add('cm-table-col-selected');
      widgetEl.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach((tr) => {
        const td = tr.children[colIdx] as HTMLElement | undefined;
        td?.classList.add('cm-table-col-selected');
      });
      widgetEl.dataset.selectedCol = String(colIdx);
    }
  }

  // ── Cell ──

  private createCell(
    view: EditorView,
    tag: 'th' | 'td',
    value: string,
    colIdx: number,
    onCommit: (nextValue: string) => void,
  ): HTMLTableCellElement {
    const cell = document.createElement(tag);
    cell.className = 'cm-table-cell';
    cell.contentEditable = 'true';
    cell.spellcheck = false;
    cell.dataset.raw = value;
    cell.dataset.colIdx = String(colIdx);
    cell.innerHTML = renderInlineMarkdown(value);
    hydrateMathSpans(cell);

    const align = this.data.alignments[colIdx];
    if (align) cell.style.textAlign = align;

    // Stop mousedown from bubbling so CodeMirror doesn't try to place its
    // caret at the widget boundary; let the contentEditable element handle
    // focus + native caret placement on its own.
    cell.addEventListener('mousedown', (e) => {
      e.stopPropagation();
    });

    let editing = false;

    const commitIfChanged = () => {
      const nextValue = cell.textContent ?? '';
      const raw = cell.dataset.raw ?? '';
      if (nextValue === raw) return;
      cell.dataset.raw = nextValue;
      onCommit(nextValue);
    };

    cell.addEventListener('focus', () => {
      if (!editing) {
        editing = true;
        cell.textContent = cell.dataset.raw ?? '';
      }
    });

    cell.addEventListener('blur', (e) => {
      e.stopPropagation();
      commitIfChanged();
      editing = false;
      cell.innerHTML = renderInlineMarkdown(cell.dataset.raw ?? '');
      hydrateMathSpans(cell);
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitIfChanged();
        cell.blur();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.navigateCell(view, cell, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cell.blur();
      }
    });

    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = tag === 'th' ? -1 : Number(cell.parentElement?.dataset.rowIdx ?? -1);
      const callback = view.state.facet(editorEventCallback);
      callback?.({
        kind: EditorEventType.TableContextMenu,
        clientX: e.clientX,
        clientY: e.clientY,
        rowIdx,
        colIdx,
        alignment: this.data.alignments[colIdx],
        rowCount: this.data.rows.length,
        colCount: this.data.headers.length,
        actions: this.buildContextMenuActions(view),
      });
    });

    return cell;
  }

  private navigateCell(view: EditorView, currentCell: HTMLElement, direction: 1 | -1) {
    const container = currentCell.closest('.cm-table-widget');
    if (!container) return;

    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('th[contenteditable], td[contenteditable]'),
    );
    const idx = cells.indexOf(currentCell);
    if (idx === -1) return;

    if (direction === 1 && idx === cells.length - 1) {
      pendingTableFocus.set(this.tableFrom, {
        row: this.data.rows.length,
        col: 0,
      });
      this.addRowAt(view, this.data.rows.length, 'below');
      return;
    }

    if (direction === -1 && idx === 0) {
      view.focus();
      view.dispatch({ selection: { anchor: this.tableFrom } });
      return;
    }

    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= cells.length) return;
    focusCellEnd(cells[nextIdx]);
  }

  // ── Context menu actions exposed to the host React layer ──

  private buildContextMenuActions(view: EditorView): TableContextMenuActions {
    return {
      addRowAt: (rowIdx, position) => this.addRowAt(view, rowIdx, position),
      deleteRow: (rowIdx) => this.deleteRow(view, rowIdx),
      addColumnAt: (colIdx, position) => this.addColumnAt(view, colIdx, position),
      deleteColumn: (colIdx) => this.deleteColumn(view, colIdx),
      setAlignment: (colIdx, alignment) => this.setAlignment(view, colIdx, alignment),
      toggleSource: () => this.toggleSource(view),
      copyMarkdown: () => this.copyMarkdown(),
      deleteTable: () => this.deleteTable(view),
    };
  }

  // ── Commit handlers ──

  private commitHeader(view: EditorView, colIdx: number, nextValue: string) {
    const updated = cloneTableData(this.data);
    updated.headers[colIdx] = nextValue;
    this.dispatchTableChange(view, updated);
  }

  private commitCell(view: EditorView, rowIdx: number, colIdx: number, nextValue: string) {
    const updated = cloneTableData(this.data);
    updated.rows[rowIdx][colIdx] = nextValue;
    this.dispatchTableChange(view, updated);
  }

  private dispatchTableChange(view: EditorView, newData: TableData) {
    const markdown = serializeMarkdownTable(newData);
    view.dispatch({
      changes: { from: this.tableFrom, to: this.tableTo, insert: markdown },
    });
  }

  // ── Structural operations ──

  private addRowAt(view: EditorView, rowIdx: number, position: 'above' | 'below') {
    const updated = cloneTableData(this.data);
    const insertAt = position === 'above' ? rowIdx : rowIdx + 1;
    updated.rows.splice(insertAt, 0, this.data.headers.map(() => ''));
    this.dispatchTableChange(view, updated);
  }

  private deleteRow(view: EditorView, rowIdx: number) {
    if (rowIdx < 0 || rowIdx >= this.data.rows.length) return;
    const updated = cloneTableData(this.data);
    updated.rows.splice(rowIdx, 1);
    this.dispatchTableChange(view, updated);
  }

  private addColumnAt(view: EditorView, colIdx: number, position: 'left' | 'right') {
    const updated = cloneTableData(this.data);
    const insertAt = position === 'left' ? colIdx : colIdx + 1;
    updated.headers.splice(insertAt, 0, '');
    updated.alignments.splice(insertAt, 0, null);
    updated.rows.forEach((row) => row.splice(insertAt, 0, ''));
    this.dispatchTableChange(view, updated);
  }

  private deleteColumn(view: EditorView, colIdx: number) {
    if (this.data.headers.length <= 1) return;
    if (colIdx < 0 || colIdx >= this.data.headers.length) return;
    const updated = cloneTableData(this.data);
    updated.headers.splice(colIdx, 1);
    updated.alignments.splice(colIdx, 1);
    updated.rows.forEach((row) => row.splice(colIdx, 1));
    this.dispatchTableChange(view, updated);
  }

  private setAlignment(view: EditorView, colIdx: number, alignment: Alignment) {
    if (this.data.alignments[colIdx] === alignment) return;
    const updated = cloneTableData(this.data);
    updated.alignments[colIdx] = alignment;
    this.dispatchTableChange(view, updated);
  }

  private toggleSource(view: EditorView) {
    view.dispatch({
      effects: setTableSourceMode.of({
        from: this.tableFrom,
        to: this.tableTo,
        showSource: true,
      }),
    });
  }

  private deleteTable(view: EditorView) {
    view.dispatch({
      changes: { from: this.tableFrom, to: this.tableTo, insert: '' },
    });
  }

  private copyMarkdown() {
    const md = serializeMarkdownTable(this.data);
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = md;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        // best-effort
      }
      document.body.removeChild(ta);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(md).catch(fallback);
    } else {
      fallback();
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function focusCellEnd(target: HTMLElement) {
  target.focus();
  const range = document.createRange();
  range.selectNodeContents(target);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function clearTableSelection(widgetEl: HTMLElement) {
  widgetEl
    .querySelectorAll<HTMLElement>('.cm-table-row-selected, .cm-table-col-selected')
    .forEach((el) => {
      el.classList.remove('cm-table-row-selected');
      el.classList.remove('cm-table-col-selected');
    });
  delete widgetEl.dataset.selectedRow;
  delete widgetEl.dataset.selectedCol;
}

// ─── Source-mode "Table" toggle widget ──────────────────────────

// Source-mode toggle widget keeps default `ignoreEvent` (false) since it has
// no contentEditable children — the small icon button handles its own click.
class TableSourceToggleWidget extends WidgetType {
  constructor(
    private readonly tableFrom: number,
    private readonly tableTo: number,
  ) {
    super();
  }

  eq(other: TableSourceToggleWidget): boolean {
    return this.tableFrom === other.tableFrom && this.tableTo === other.tableTo;
  }

  toDOM(view: EditorView): HTMLElement {
    const container = document.createElement('div');
    container.className = 'cm-table-source-toggle';

    container.appendChild(
      iconButton(
        'table',
        'Switch to table view',
        () => {
          view.dispatch({
            effects: setTableSourceMode.of({
              from: this.tableFrom,
              to: this.tableTo,
              showSource: false,
            }),
          });
        },
        'cm-table-source-toggle-btn',
      ),
    );

    return container;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

// ─── StateField ─────────────────────────────────────────────────

function buildTableDecorations(state: EditorState): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const sourceRanges = state.field(tableSourceModeField);

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Table') return;

      const tableSource = state.doc.sliceString(node.from, node.to);
      const tableData = parseMarkdownTable(tableSource);
      if (!tableData) return;

      const showSource = isTableInSourceMode(sourceRanges, node.from, node.to);

      if (!showSource) {
        decorations.push(
          Decoration.replace({
            widget: new EditableTableWidget(tableData, node.from, node.to),
            block: true,
          }).range(node.from, node.to),
        );
        return;
      }

      decorations.push(
        Decoration.widget({
          widget: new TableSourceToggleWidget(node.from, node.to),
          block: true,
          side: -1,
        }).range(node.from),
      );
      for (let pos = node.from; pos <= node.to; ) {
        const line = state.doc.lineAt(pos);
        decorations.push(Decoration.line({ class: 'cm-table-source-mode' }).range(line.from));
        pos = line.to + 1;
      }
    },
  });

  return Decoration.set(
    decorations.sort((a, b) => a.from - b.from),
    true,
  );
}

const tableField = StateField.define<DecorationSet>({
  create(state) {
    return buildTableDecorations(state);
  },
  update(deco, tr) {
    const hasModeToggle = tr.effects.some((e) => e.is(setTableSourceMode));
    if (tr.docChanged || tr.reconfigured || hasModeToggle) {
      return buildTableDecorations(tr.state);
    }
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ─── Theme ──────────────────────────────────────────────────────

const blockTableTheme = EditorView.theme({
  '.cm-table-widget': {
    position: 'relative',
    // padding-top reserves room for the per-column `:::` handle that floats
    // above each `<th>` (top:-18px from the th, +4px breathing room).
    padding: '24px 8px 8px 24px',
    overflowX: 'auto',
    overflowY: 'visible',
  },
  '.cm-table-widget table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.95em',
  },
  '.cm-table-widget th, .cm-table-widget td': {
    border: '1px solid var(--cm-table-border)',
    padding: '6px 12px',
    outline: 'none',
    minWidth: '40px',
    position: 'relative',
  },
  '.cm-table-widget th': {
    fontWeight: '600',
  },
  '.cm-table-widget tbody tr': {
    position: 'relative',
  },
  // Selection ring uses an absolutely-positioned `::before` pseudo-element
  // as a backdrop layer. This sidesteps both `border-collapse: collapse`
  // (which silently drops `border-radius` on cells) and the layout shift
  // that border-width changes would cause. `inset: -1px` extends the ring
  // 1px outside the cell so it visually replaces the underlying gray
  // 1px border on the four outer edges, while internal cell dividers
  // (rendered by neighbouring cells) remain intact.

  // ── Selected row ──
  '.cm-table-widget tbody tr.cm-table-row-selected td': {
    background: 'var(--cm-table-selection-bg)',
  },
  '.cm-table-widget tbody tr.cm-table-row-selected td::before': {
    content: '""',
    position: 'absolute',
    inset: '-2px',
    pointerEvents: 'none',
    borderTop: '2px solid var(--cm-table-selection-border)',
    borderBottom: '2px solid var(--cm-table-selection-border)',
  },
  '.cm-table-widget tbody tr.cm-table-row-selected td:first-child::before': {
    borderLeft: '2px solid var(--cm-table-selection-border)',
    borderTopLeftRadius: '6px',
    borderBottomLeftRadius: '6px',
  },
  '.cm-table-widget tbody tr.cm-table-row-selected td:last-child::before': {
    borderRight: '2px solid var(--cm-table-selection-border)',
    borderTopRightRadius: '6px',
    borderBottomRightRadius: '6px',
  },

  // ── Selected column ──
  '.cm-table-widget tbody tr td.cm-table-col-selected, .cm-table-widget thead tr th.cm-table-col-selected':
    {
      background: 'var(--cm-table-selection-bg)',
    },
  '.cm-table-widget tbody tr td.cm-table-col-selected::before, .cm-table-widget thead tr th.cm-table-col-selected::before':
    {
      content: '""',
      position: 'absolute',
      inset: '-2px',
      pointerEvents: 'none',
      borderLeft: '2px solid var(--cm-table-selection-border)',
      borderRight: '2px solid var(--cm-table-selection-border)',
    },
  '.cm-table-widget thead tr th.cm-table-col-selected::before': {
    borderTop: '2px solid var(--cm-table-selection-border)',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
  },
  '.cm-table-widget tbody tr:last-child td.cm-table-col-selected::before': {
    borderBottom: '2px solid var(--cm-table-selection-border)',
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },
  '.cm-table-widget code': {
    background: 'var(--cm-table-header-bg)',
    borderRadius: '3px',
    padding: '0 4px',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
  '.cm-table-widget a': {
    color: 'var(--cm-link, currentColor)',
    textDecoration: 'underline',
  },
  '.cm-table-widget img': {
    maxWidth: '100%',
    verticalAlign: 'middle',
    display: 'inline-block',
  },
  '.cm-table-math': {
    display: 'inline-block',
    verticalAlign: 'middle',
  },

  // ── Row handle (left gutter) ──
  '.cm-table-row-handle': {
    position: 'absolute',
    left: '-22px',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '20px',
    border: 'none',
    background: 'transparent',
    color: 'var(--cm-table-affordance-fg)',
    cursor: 'pointer',
    padding: '0',
    borderRadius: '4px',
    opacity: '0',
    transition: 'opacity 0.15s',
    lineHeight: '0',
    zIndex: '1',
  },
  // Row handle reveals strictly on pointer hover. Selection (and cell
  // focus-within) do NOT keep it visible — the colored border ring is the
  // selection cue; the handle staying around once the cursor leaves would
  // duplicate the cue and clutter the gutter.
  '.cm-table-widget tbody tr:hover .cm-table-row-handle': {
    opacity: '1',
  },
  '.cm-table-row-handle:hover': {
    background: 'var(--cm-table-affordance-bg-hover)',
  },

  // ── Column handle (top of each th) ──
  '.cm-table-col-handle': {
    position: 'absolute',
    top: '-18px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '14px',
    border: 'none',
    background: 'transparent',
    color: 'var(--cm-table-affordance-fg)',
    cursor: 'pointer',
    padding: '0',
    borderRadius: '4px',
    opacity: '0',
    transition: 'opacity 0.15s',
    lineHeight: '0',
    zIndex: '1',
  },
  '.cm-table-widget th:hover .cm-table-col-handle': {
    opacity: '1',
  },
  '.cm-table-col-handle:hover': {
    background: 'var(--cm-table-affordance-bg-hover)',
  },

  // ── Source mode ──
  '.cm-table-source-mode': {
    fontFamily: 'monospace',
    fontSize: '0.95em',
  },
  '.cm-table-source-toggle': {
    padding: '4px 0',
    display: 'flex',
    justifyContent: 'flex-start',
  },
  '.cm-table-source-toggle-btn': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    border: '1px solid var(--cm-table-border)',
    background: 'var(--cm-table-header-bg)',
    color: 'var(--cm-table-affordance-fg)',
    cursor: 'pointer',
    padding: '0',
    borderRadius: '4px',
    lineHeight: '0',
  },
  '.cm-table-source-toggle-btn:hover': {
    background: 'var(--cm-table-affordance-bg-hover)',
  },
});

// ─── Export ─────────────────────────────────────────────────────

export function createBlockTableExtension() {
  return [tableSourceModeField, blockTableTheme, tableField];
}
