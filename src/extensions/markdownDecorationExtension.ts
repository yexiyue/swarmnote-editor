import { RangeSetBuilder, type Extension } from '@codemirror/state';
import { ensureSyntaxTree } from '@codemirror/language';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from '@codemirror/view';

const lineDecorations: Record<string, Decoration> = {
  Blockquote: Decoration.line({ attributes: { class: 'cm-blockQuote' } }),
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
};

const markdownTheme = EditorView.theme({
  '.cm-headerLine': {
    fontWeight: '700',
    lineHeight: '1.3',
  },
  '.cm-h1': {
    fontSize: '1.9em',
    letterSpacing: '-0.03em',
    paddingTop: '20px',
    paddingBottom: '4px',
  },
  '.cm-h2': {
    fontSize: '1.55em',
    letterSpacing: '-0.02em',
    paddingTop: '16px',
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
  '.cm-blockQuote': {
    borderLeft: '3px solid rgba(180, 140, 55, 0.6)',
    paddingLeft: '14px',
    fontStyle: 'italic',
  },
  '.cm-url': {
    textDecoration: 'underline',
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
