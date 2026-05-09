import type { EditorView } from '@codemirror/view';

const blockquoteRegex = /^(\s*)>\s?/;

interface DetectedBlockquote {
  indent: string;
  fullMatch: string;
}

function detectBlockquote(lineText: string): DetectedBlockquote | null {
  const m = lineText.match(blockquoteRegex);
  if (!m) return null;
  return { indent: m[1], fullMatch: m[0] };
}

/**
 * Toggle blockquote prefix (`> `) on every line covered by the current
 * selection. If every covered line is already a blockquote, all `> ` prefixes
 * are removed; otherwise every non-blockquote line gets a `> ` prefix added
 * (preserving its existing indent). Single-cursor case acts on the cursor's
 * line.
 */
export function toggleBlockquote(view: EditorView): void {
  const { from, to } = view.state.selection.main;
  const fromLine = view.state.doc.lineAt(from);
  const toLine = view.state.doc.lineAt(to);

  const lines: { line: ReturnType<typeof view.state.doc.lineAt>; detected: DetectedBlockquote | null }[] = [];
  for (let pos = fromLine.from; pos <= toLine.to; ) {
    const line = view.state.doc.lineAt(pos);
    lines.push({ line, detected: detectBlockquote(line.text) });
    if (line.to >= toLine.to) break;
    pos = line.to + 1;
  }

  const allBlockquoted = lines.every((entry) => entry.detected !== null);

  const changes: { from: number; to: number; insert: string }[] = [];
  if (allBlockquoted) {
    for (const { line, detected } of lines) {
      if (!detected) continue;
      changes.push({
        from: line.from + detected.indent.length,
        to: line.from + detected.fullMatch.length,
        insert: '',
      });
    }
  } else {
    for (const { line, detected } of lines) {
      if (detected) continue;
      const indentMatch = line.text.match(/^(\s*)/);
      const indentLen = indentMatch ? indentMatch[1].length : 0;
      changes.push({
        from: line.from + indentLen,
        to: line.from + indentLen,
        insert: '> ',
      });
    }
  }

  if (changes.length === 0) return;
  view.dispatch({ changes });
}
