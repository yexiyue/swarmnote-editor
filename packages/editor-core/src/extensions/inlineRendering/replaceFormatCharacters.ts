import { Decoration } from '@codemirror/view';
import type { InlineRenderingSpec, RevealStrategy } from './types';

// HeaderMark uses 'line' — the entire heading line *is* the heading, so cursor
// anywhere on the line reveals `#` (matches Obsidian behaviour).
// QuoteMark uses 'active' + prefix reveal — the body text inside a blockquote
// is not part of the `>` mark itself, so cursor in body keeps `>` concealed.
const lineRevealNodes = new Set(['HeaderMark']);
const activeRevealNodes = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMarker',
  'LinkMark',
  'URL',
  'QuoteMark',
  'CodeMark',
]);

/**
 * Mark-type nodes whose reveal judgement should expand to the parent node's
 * full range. Cursor anywhere within the parent → both ends of the mark reveal.
 */
const expandRevealToParent = new Set([
  'EmphasisMark',
  'StrikethroughMark',
  'HighlightMarker',
  'LinkMark',
  'URL',
  'CodeMark',
]);

const hiddenDecoration = Decoration.replace({});

export const replaceFormatCharacters: InlineRenderingSpec = {
  nodeNames: [
    'HeaderMark',
    'CodeMark',
    'EmphasisMark',
    'StrikethroughMark',
    'HighlightMarker',
    'QuoteMark',
    'LinkMark',
    'URL',
  ],
  extension: {
    createDecoration() {
      return hiddenDecoration;
    },
    getDecorationRange(node, state) {
      // For HeaderMark, include the trailing space if present
      if (node.name === 'HeaderMark') {
        const afterMark = state.sliceDoc(node.to, node.to + 1);
        if (afterMark === ' ') {
          return [node.from, node.to + 1];
        }
      }
      return null;
    },
    getRevealStrategy(node): RevealStrategy {
      if (lineRevealNodes.has(node.name)) return 'line';
      if (activeRevealNodes.has(node.name)) return 'active';
      return 'line';
    },
    getRevealRange(node, state) {
      // Paired inline marks: reveal whenever cursor is anywhere in the parent
      // (e.g. cursor in `**bold**` body → both `**` show together).
      if (expandRevealToParent.has(node.name)) {
        const parent = node.node.parent;
        if (!parent) return null;
        return [parent.from, parent.to];
      }
      // QuoteMark `>` (handles nested `> > > ` prefix uniformly)
      if (node.name === 'QuoteMark') {
        const line = state.doc.lineAt(node.from);
        const match = line.text.match(/^(\s*(?:>\s*)+)/);
        if (match) return [line.from, line.from + match[0].length];
      }
      return null;
    },
  },
};
