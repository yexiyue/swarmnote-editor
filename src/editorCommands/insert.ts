import { EditorSelection } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

export function insertCodeBlock(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (selected) {
    const insert = `\`\`\`\n${selected}\n\`\`\``;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
    });
  } else {
    const insert = '```\n\n```';
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + 4),
    });
  }
}

export function insertHorizontalRule(view: EditorView): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.length > 0 ? '\n' : '';
  const insert = `${prefix}---\n`;

  view.dispatch({
    changes: { from: line.to, to: line.to, insert },
    selection: EditorSelection.cursor(line.to + insert.length),
  });
}

export function insertTable(view: EditorView): void {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const prefix = line.text.length > 0 ? '\n' : '';
  const table = `${prefix}| Header 1 | Header 2 | Header 3 |\n| -------- | -------- | -------- |\n| Cell 1   | Cell 2   | Cell 3   |\n`;

  view.dispatch({
    changes: { from: line.to, to: line.to, insert: table },
    selection: EditorSelection.cursor(line.to + prefix.length + 2),
  });
}

/**
 * Insert a Markdown link at the current selection or cursor.
 *
 * - When called with a URL: inserts `[text](url)` (where `text` is the current
 *   selection or the provided `text`, falling back to the URL itself).
 * - When called with no URL: inserts `[text](url)` template and selects the
 *   `url` portion so the user can type over it.
 */
export function insertLink(view: EditorView, url?: string, text?: string): void {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);

  if (url) {
    const display = text ?? selected ?? url;
    const insert = `[${display}](${url})`;
    view.dispatch({
      changes: { from, to, insert },
      selection: EditorSelection.cursor(from + insert.length),
    });
    return;
  }

  // No URL provided — insert placeholder and select the "url" portion.
  const display = selected.length > 0 ? selected : 'text';
  const insert = `[${display}](url)`;
  const urlFrom = from + display.length + 3; // past "[display]("
  const urlTo = urlFrom + 3; // "url"
  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.single(urlFrom, urlTo),
  });
}

/**
 * Insert a Markdown image on its own line (block image).
 *
 * If the cursor is mid-line, a preceding newline is added so the image stays
 * block-level (required for the block image widget to render it).
 */
export function insertImage(view: EditorView, url: string, alt = ''): void {
  const { from, to } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);

  const needsLeadingNewline = from !== line.from;
  const needsTrailingNewline = to === line.to && line.to < view.state.doc.length
    ? view.state.doc.sliceString(line.to, line.to + 1) !== '\n'
    : to !== line.to;

  const insert = `${needsLeadingNewline ? '\n' : ''}![${alt}](${url})${needsTrailingNewline ? '\n' : ''}`;

  view.dispatch({
    changes: { from, to, insert },
    selection: EditorSelection.cursor(from + insert.length),
  });
}
