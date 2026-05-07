import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const taskCompletedDecoration = Decoration.line({ attributes: { class: 'cm-taskCompleted' } });
const TASK_COMPLETED_LINE = /^\s*[-*]\s\[[xX]\]/;

// Per-depth blockquote line decorations. Depth 0 = outer, 1 = nested once, etc.
// Using multiple `box-shadow: inset` rules in CSS to draw stacked vertical bars
// for nested blockquotes (matches Obsidian's two-bar look on `> > nested`).
const blockquoteLineDecorations = [
  Decoration.line({ attributes: { class: 'cm-blockQuote cm-blockQuote-d0' } }),
  Decoration.line({ attributes: { class: 'cm-blockQuote cm-blockQuote-d1' } }),
  Decoration.line({ attributes: { class: 'cm-blockQuote cm-blockQuote-d2' } }),
  Decoration.line({ attributes: { class: 'cm-blockQuote cm-blockQuote-d3' } }),
];

const lineDecorations: Record<string, Decoration> = {
  OrderedList: Decoration.line({ attributes: { class: 'cm-orderedList' } }),
  BulletList: Decoration.line({ attributes: { class: 'cm-unorderedList' } }),
  ListItem: Decoration.line({ attributes: { class: 'cm-listItem' } }),
  FencedCode: Decoration.line({ attributes: { class: 'cm-codeBlock' } }),
  CodeBlock: Decoration.line({ attributes: { class: 'cm-codeBlock' } }),
  SetextHeading1: Decoration.line({ attributes: { class: 'cm-h1 cm-headerLine cm-header' } }),
  ATXHeading1: Decoration.line({ attributes: { class: 'cm-h1 cm-headerLine cm-header' } }),
  SetextHeading2: Decoration.line({ attributes: { class: 'cm-h2 cm-headerLine cm-header' } }),
  ATXHeading2: Decoration.line({ attributes: { class: 'cm-h2 cm-headerLine cm-header' } }),
  ATXHeading3: Decoration.line({ attributes: { class: 'cm-h3 cm-headerLine cm-header' } }),
  ATXHeading4: Decoration.line({ attributes: { class: 'cm-h4 cm-headerLine cm-header' } }),
  ATXHeading5: Decoration.line({ attributes: { class: 'cm-h5 cm-headerLine cm-header' } }),
  ATXHeading6: Decoration.line({ attributes: { class: 'cm-h6 cm-headerLine cm-header' } }),
  TableHeader: Decoration.line({ attributes: { class: 'cm-tableHeader' } }),
  TableDelimiter: Decoration.line({ attributes: { class: 'cm-tableDelimiter' } }),
  TableRow: Decoration.line({ attributes: { class: 'cm-tableRow' } }),
  FrontMatter: Decoration.line({ attributes: { class: 'cm-frontMatter' } }),
  FrontMatterMarker: Decoration.line({ attributes: { class: 'cm-frontMatter cm-frontMatterMarker' } }),
  FrontMatterContent: Decoration.line({ attributes: { class: 'cm-frontMatter cm-frontMatterContent' } }),
};

const markDecorations: Record<string, Decoration> = {
  InlineCode: Decoration.mark({ attributes: { class: 'cm-inlineCode', spellcheck: 'false' } }),
  URL: Decoration.mark({ attributes: { class: 'cm-url', spellcheck: 'false' } }),
  TaskMarker: Decoration.mark({ attributes: { class: 'cm-taskMarker' } }),
  HorizontalRule: Decoration.mark({ attributes: { class: 'cm-hr' } }),
  Highlight: Decoration.mark({ attributes: { class: 'cm-highlighted' } }),
  HeaderMark: Decoration.mark({ attributes: { class: 'cm-headerMark' } }),
  QuoteMark: Decoration.mark({ attributes: { class: 'cm-quoteMark' } }),
};

const markdownTheme = EditorView.theme({
  '.cm-headerLine': {
    fontWeight: '700',
    lineHeight: '1.3',
  },
  '.cm-h1': {
    fontSize: '1.9em',
    letterSpacing: '-0.03em',
    paddingTop: '12px',
    paddingBottom: '4px',
  },
  '.cm-h2': {
    fontSize: '1.55em',
    letterSpacing: '-0.02em',
    paddingTop: '12px',
  },
  '.cm-h3': {
    fontSize: '1.35em',
    letterSpacing: '-0.01em',
    paddingTop: '12px',
  },
  '.cm-h4, .cm-h5, .cm-h6': {
    fontSize: '1.1em',
    paddingTop: '8px',
  },
  '.cm-inlineCode': {
    backgroundColor: 'rgba(127, 127, 127, 0.12)',
    borderRadius: '4px',
    fontFamily: 'monospace',
    padding: '0.1em 0.4em',
    border: '1px solid rgba(127, 127, 127, 0.18)',
  },
  '.cm-codeBlock': {
    backgroundColor: 'rgba(127, 127, 127, 0.1)',
  },
  // Blockquote bars are drawn via background-image gradients (one per depth bar).
  // Each bar is 2px wide, anchored at fixed x positions: 0, 14px, 28px, 42px.
  '.cm-blockQuote-d0': {
    backgroundImage:
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6))',
    backgroundSize: '2px 100%',
    backgroundPosition: '0 0',
    backgroundRepeat: 'no-repeat',
    paddingLeft: '10px',
  },
  '.cm-blockQuote-d1': {
    backgroundImage:
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6))',
    backgroundSize: '2px 100%, 2px 100%',
    backgroundPosition: '0 0, 14px 0',
    backgroundRepeat: 'no-repeat, no-repeat',
    paddingLeft: '24px',
  },
  '.cm-blockQuote-d2': {
    backgroundImage:
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6))',
    backgroundSize: '2px 100%, 2px 100%, 2px 100%',
    backgroundPosition: '0 0, 14px 0, 28px 0',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat',
    paddingLeft: '38px',
  },
  '.cm-blockQuote-d3': {
    backgroundImage:
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6)), ' +
      'linear-gradient(rgba(180, 140, 55, 0.6), rgba(180, 140, 55, 0.6))',
    backgroundSize: '2px 100%, 2px 100%, 2px 100%, 2px 100%',
    backgroundPosition: '0 0, 14px 0, 28px 0, 42px 0',
    backgroundRepeat: 'no-repeat, no-repeat, no-repeat, no-repeat',
    paddingLeft: '52px',
  },
  '.cm-url': {
    textDecoration: 'underline',
  },
  '.cm-headerMark': {
    opacity: '0.35',
    marginRight: '0.25em',
  },
  '.cm-quoteMark': {
    opacity: '0.45',
  },
  '.cm-taskCompleted, .cm-taskCompleted span': {
    textDecoration: 'line-through',
    color: 'rgba(127, 127, 127, 0.75)',
  },
  '.cm-taskMarker': {
    fontWeight: '700',
  },
  '.cm-highlighted': {
    backgroundColor: 'rgba(255, 200, 15, 0.32)',
    borderRadius: '2px',
  },
  '.cm-tableHeader, .cm-tableRow, .cm-tableDelimiter': {
    fontFamily: 'monospace',
    fontSize: '0.95em',
  },
  '.cm-tableHeader': {
    fontWeight: '700',
  },
  '.cm-tableDelimiter': {
    color: 'rgba(127, 127, 127, 0.5)',
  },
  '.cm-frontMatter': {
    color: 'rgba(127, 127, 127, 0.65)',
    fontFamily: 'monospace',
    fontSize: '0.88em',
    borderLeft: '2px solid rgba(127, 127, 127, 0.2)',
    paddingLeft: '8px',
  },
  '.cm-frontMatterMarker': {
    color: 'rgba(127, 127, 127, 0.45)',
  },
});

type DecorationDescription = {
  from: number;
  to: number;
  decoration: Decoration;
};

function pushLineDecorations(
  decorations: DecorationDescription[],
  view: EditorView,
  from: number,
  to: number,
  decoration: Decoration,
) {
  let position = from;
  while (position <= to) {
    const line = view.state.doc.lineAt(position);
    decorations.push({
      from: line.from,
      to: line.from,
      decoration,
    });
    position = line.to + 1;
  }
}

function computeDecorations(view: EditorView): DecorationSet {
  const decorations: DecorationDescription[] = [];

  for (const { from, to } of view.visibleRanges) {
    ensureSyntaxTree(view.state, to)?.iterate({
      from,
      to,
      enter(node) {
        const visibleFrom = Math.max(from, node.from);
        const visibleTo = Math.min(to, node.to);

        const lineDecoration = lineDecorations[node.name];
        if (lineDecoration) {
          pushLineDecorations(decorations, view, visibleFrom, visibleTo, lineDecoration);
        }

        // Blockquote with depth awareness: outer = single bar, nested = two bars.
        if (node.name === 'Blockquote') {
          let depth = 0;
          let p = node.node.parent;
          while (p) {
            if (p.name === 'Blockquote') depth++;
            p = p.parent;
          }
          const idx = Math.min(depth, blockquoteLineDecorations.length - 1);
          pushLineDecorations(decorations, view, visibleFrom, visibleTo, blockquoteLineDecorations[idx]);
        }

        // Apply line-through + muted color when the ListItem starts with `[x]`.
        // We check on ListItem (not TaskMarker) so the decoration covers the
        // whole line, including text after the marker.
        if (node.name === 'ListItem') {
          const lineText = view.state.doc.lineAt(node.from).text;
          if (TASK_COMPLETED_LINE.test(lineText)) {
            pushLineDecorations(decorations, view, visibleFrom, visibleTo, taskCompletedDecoration);
          }
        }

        const markDecoration = markDecorations[node.name];
        if (markDecoration && visibleFrom < visibleTo) {
          decorations.push({
            from: visibleFrom,
            to: visibleTo,
            decoration: markDecoration,
          });
        }
      },
    });
  }

  decorations.sort((left, right) => {
    const fromDiff = left.from - right.from;
    if (fromDiff !== 0) {
      return fromDiff;
    }

    return left.to - right.to;
  });

  const builder = new RangeSetBuilder<Decoration>();
  for (const decoration of decorations) {
    builder.add(decoration.from, decoration.to, decoration.decoration);
  }

  return builder.finish();
}

const markdownDecorationPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = computeDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = computeDecorations(update.view);
      }
    }
  },
  {
    decorations: (value) => value.decorations,
  },
);

export function createMarkdownDecorationExtension(): Extension {
  return [markdownTheme, markdownDecorationPlugin];
}
