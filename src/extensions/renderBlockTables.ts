/**
 * Live-preview rendering of GFM markdown tables.
 *
 * Two display modes per-table, switchable via the "MD" toolbar button:
 * - widget mode (default) — `EditableTableWidget` with contentEditable cells
 * - source mode — raw markdown lines with a "Table" button to switch back
 *
 * Cell editing uses on-blur / on-Enter commit (NOT onInput): this keeps IME
 * composition uninterrupted and produces single Yjs deltas per edit. Cells
 * render inline markdown when not focused (`renderInlineMarkdown`) and reveal
 * raw source on focus.
 *
 * Markdown write-back uses a single-space serializer — no column-width
 * padding, no whitespace mutation. Users keep their original formatting.
 */
import { syntaxTree } from '@codemirror/language';
import {
  type EditorState,
  type Range,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { renderInlineMarkdown } from '../utils/renderInlineMarkdown';

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

// ─── Markdown Generation (no auto-alignment) ────────────────────

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

// ─── Alignment cycling ──────────────────────────────────────────

const alignmentCycle: Alignment[] = ['left', 'center', 'right', null];

function nextAlignment(current: Alignment): Alignment {
  const idx = alignmentCycle.indexOf(current);
  return alignmentCycle[(idx + 1) % alignmentCycle.length];
}

function alignmentLabel(a: Alignment): string {
  switch (a) {
    case 'left':
      return '←';
    case 'center':
      return '↔';
    case 'right':
      return '→';
    default:
      return '—';
  }
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

    container.appendChild(this.buildToolbar(view));
    container.appendChild(this.buildAlignRow(view));
    container.appendChild(this.buildTable(view));

    return container;
  }

  private buildToolbar(view: EditorView): HTMLElement {
    const toolbar = document.createElement('div');
    toolbar.className = 'cm-table-toolbar';

    toolbar.append(
      this.makeToolbarButton('+ Row', () => this.addRow(view)),
      this.makeToolbarButton('- Row', () => this.deleteRow(view)),
      this.makeToolbarButton('+ Col', () => this.addColumn(view)),
      this.makeToolbarButton('- Col', () => this.deleteColumn(view)),
      this.makeToolbarButton('MD', () => this.toggleSource(view)),
    );

    return toolbar;
  }

  private buildAlignRow(view: EditorView): HTMLElement {
    const alignRow = document.createElement('div');
    alignRow.className = 'cm-table-align-row';

    this.data.alignments.forEach((a, colIdx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cm-table-align-btn';
      btn.textContent = alignmentLabel(a);
      btn.title = 'Toggle alignment';
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleAlignment(view, colIdx);
      });
      alignRow.appendChild(btn);
    });

    return alignRow;
  }

  private buildTable(view: EditorView): HTMLElement {
    const table = document.createElement('table');

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    this.data.headers.forEach((header, idx) => {
      headerRow.appendChild(this.createCell('th', header, idx, (next) => this.commitHeader(view, idx, next)));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.data.rows.forEach((row, rowIdx) => {
      const tr = document.createElement('tr');
      row.forEach((cell, colIdx) => {
        tr.appendChild(
          this.createCell('td', cell, colIdx, (next) => this.commitCell(view, rowIdx, colIdx, next)),
        );
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    return table;
  }

  private createCell(
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
    cell.innerHTML = renderInlineMarkdown(value);

    const align = this.data.alignments[colIdx];
    if (align) cell.style.textAlign = align;

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
    });

    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitIfChanged();
        cell.blur();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        this.navigateCell(cell, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        cell.blur();
      }
    });

    return cell;
  }

  private navigateCell(currentCell: HTMLElement, direction: 1 | -1) {
    const container = currentCell.closest('.cm-table-widget');
    if (!container) return;

    const cells = Array.from(
      container.querySelectorAll<HTMLElement>('th[contenteditable], td[contenteditable]'),
    );
    const idx = cells.indexOf(currentCell);
    if (idx === -1) return;

    let nextIdx = idx + direction;
    if (nextIdx < 0) nextIdx = cells.length - 1;
    if (nextIdx >= cells.length) nextIdx = 0;

    cells[nextIdx].focus();
    const range = document.createRange();
    range.selectNodeContents(cells[nextIdx]);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  ignoreEvent(): boolean {
    return false;
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

  private addRow(view: EditorView) {
    const updated = cloneTableData(this.data);
    updated.rows.push(this.data.headers.map(() => ''));
    this.dispatchTableChange(view, updated);
  }

  private deleteRow(view: EditorView) {
    if (this.data.rows.length === 0) return;
    const updated = cloneTableData(this.data);
    updated.rows.pop();
    this.dispatchTableChange(view, updated);
  }

  private addColumn(view: EditorView) {
    const updated = cloneTableData(this.data);
    updated.headers.push('');
    updated.alignments.push(null);
    updated.rows.forEach((row) => row.push(''));
    this.dispatchTableChange(view, updated);
  }

  private deleteColumn(view: EditorView) {
    if (this.data.headers.length <= 1) return;
    const updated = cloneTableData(this.data);
    updated.headers.pop();
    updated.alignments.pop();
    updated.rows.forEach((row) => row.pop());
    this.dispatchTableChange(view, updated);
  }

  private toggleAlignment(view: EditorView, colIdx: number) {
    const updated = cloneTableData(this.data);
    updated.alignments[colIdx] = nextAlignment(updated.alignments[colIdx]);
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

  private makeToolbarButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-table-toolbar-btn';
    btn.textContent = label;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }
}

// ─── Source-mode "Table" toggle widget ──────────────────────────

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

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cm-table-toolbar-btn';
    button.textContent = 'Table';
    button.title = 'Render as table';
    button.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      view.dispatch({
        effects: setTableSourceMode.of({
          from: this.tableFrom,
          to: this.tableTo,
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

      // Source mode: line decorations + a "Table" toggle widget at the top
      decorations.push(
        Decoration.widget({
          widget: new TableSourceToggleWidget(node.from, node.to),
          block: true,
          side: -1,
        }).range(node.from),
      );
      for (let pos = node.from; pos <= node.to; ) {
        const line = state.doc.lineAt(pos);
        decorations.push(
          Decoration.line({ class: 'cm-table-source-mode' }).range(line.from),
        );
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
    padding: '4px 0',
    overflowX: 'auto',
  },
  '.cm-table-toolbar': {
    display: 'flex',
    gap: '4px',
    padding: '2px 0 4px',
    opacity: '0',
    transition: 'opacity 0.15s',
  },
  '.cm-table-widget:hover .cm-table-toolbar, .cm-table-widget:focus-within .cm-table-toolbar': {
    opacity: '1',
  },
  '.cm-table-toolbar-btn': {
    border: '1px solid rgba(127, 127, 127, 0.25)',
    background: 'rgba(127, 127, 127, 0.06)',
    color: 'rgba(127, 127, 127, 0.8)',
    cursor: 'pointer',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.8em',
    fontFamily: 'inherit',
  },
  '.cm-table-align-row': {
    display: 'flex',
    gap: '0',
  },
  '.cm-table-align-btn': {
    flex: '1',
    border: '1px solid rgba(127, 127, 127, 0.2)',
    borderBottom: 'none',
    background: 'rgba(127, 127, 127, 0.04)',
    color: 'rgba(127, 127, 127, 0.6)',
    cursor: 'pointer',
    padding: '1px 4px',
    fontSize: '0.75em',
    fontFamily: 'inherit',
    textAlign: 'center',
    opacity: '0',
    transition: 'opacity 0.15s',
  },
  '.cm-table-widget:hover .cm-table-align-btn, .cm-table-widget:focus-within .cm-table-align-btn': {
    opacity: '1',
  },
  '.cm-table-widget table': {
    borderCollapse: 'collapse',
    width: '100%',
    fontSize: '0.95em',
  },
  '.cm-table-widget th, .cm-table-widget td': {
    border: '1px solid rgba(127, 127, 127, 0.3)',
    padding: '6px 12px',
    outline: 'none',
    minWidth: '40px',
  },
  '.cm-table-widget th:focus, .cm-table-widget td:focus': {
    boxShadow: 'inset 0 0 0 2px rgba(64, 150, 255, 0.4)',
  },
  '.cm-table-widget th': {
    fontWeight: '700',
    backgroundColor: 'rgba(127, 127, 127, 0.08)',
  },
  '.cm-table-widget tr:nth-child(even)': {
    backgroundColor: 'rgba(127, 127, 127, 0.04)',
  },
  '.cm-table-widget code': {
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    borderRadius: '3px',
    padding: '0 4px',
    fontFamily: 'monospace',
    fontSize: '0.9em',
  },
  '.cm-table-widget a': {
    color: 'rgb(64, 150, 255)',
    textDecoration: 'underline',
  },
  '.cm-table-source-mode': {
    fontFamily: 'monospace',
    fontSize: '0.95em',
  },
  '.cm-table-source-toggle': {
    padding: '4px 0',
  },
});

// ─── Export ─────────────────────────────────────────────────────

export function createBlockTableExtension() {
  return [tableSourceModeField, blockTableTheme, tableField];
}
