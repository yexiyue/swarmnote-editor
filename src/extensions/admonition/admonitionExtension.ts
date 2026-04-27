/**
 * Admonition / callout block rendering.
 *
 * Recognizes GFM-style `> [!type] Title` and Obsidian-pre-callout `> **type**
 * Title` syntax inside Blockquote nodes. Adds line decorations so each line
 * gets the admonition styling, with the title line getting an additional
 * class for icon + label pseudo-elements.
 *
 * Type resolution is case-insensitive and falls back to a neutral default for
 * unknown types — imported Obsidian vaults with custom callouts won't fail to
 * render.
 *
 * Implementation follows SilverBullet's `admonition.ts` pattern (regex on
 * Blockquote nodes, no Lezer parser modification).
 */
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView } from '@codemirror/view';
import { DEFAULT_ADMONITION_TYPE, GFM_TYPES } from './presets';
import type { AdmonitionTypeConfig, AdmonitionTypesMap } from './types';

const ADMONITION_REGEX =
  /^>\s*(?:\*{2}|\[!)([a-zA-Z][a-zA-Z0-9_-]*)(?:\*{2}|\])\s*(.*)/;

const ADMONITION_LINE_SPLIT_REGEX = /\n>/g;

export interface AdmonitionOptions {
  /**
   * Map of type name → config. Default: `GFM_TYPES`. To support the full
   * Obsidian set: `{ types: { ...GFM_TYPES, ...OBSIDIAN_TYPES } }`.
   * Type lookup is case-insensitive.
   */
  types?: AdmonitionTypesMap;
}

function lookupType(types: AdmonitionTypesMap, raw: string): { config: AdmonitionTypeConfig; isKnown: boolean } {
  const direct = types[raw];
  if (direct) return { config: direct, isKnown: true };

  const lower = raw.toLowerCase();
  for (const [key, value] of Object.entries(types)) {
    if (key.toLowerCase() === lower) {
      return { config: value, isKnown: true };
    }
  }

  return {
    config: { ...DEFAULT_ADMONITION_TYPE, label: raw },
    isKnown: false,
  };
}

function buildAdmonitionDecorations(
  state: EditorState,
  types: AdmonitionTypesMap,
): DecorationSet {
  const decorations: Range<Decoration>[] = [];

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Blockquote') return;

      const rawText = state.sliceDoc(node.from, node.to);
      const match = ADMONITION_REGEX.exec(rawText);
      if (!match) return;

      const typeRaw = match[1];
      const { config } = lookupType(types, typeRaw);

      // Compute per-line offsets within the blockquote to attach decorations.
      const lineOffsets: number[] = [node.from];
      let cursor = node.from;
      const lines = rawText.split(ADMONITION_LINE_SPLIT_REGEX);
      lines.forEach((line, idx) => {
        if (idx === 0) {
          cursor += line.length;
        } else {
          // Each subsequent split removed the leading "\n>", add it back.
          cursor += 2 + line.length;
        }
        if (idx < lines.length - 1) {
          lineOffsets.push(cursor);
        }
      });

      const baseClass = `cm-admonition cm-admonition-${config.className}`;

      lineOffsets.forEach((offset, idx) => {
        const cls = idx === 0 ? `${baseClass} cm-admonition-title` : baseClass;
        const line = state.doc.lineAt(offset);
        decorations.push(
          Decoration.line({
            class: cls,
            attributes: {
              'data-admonition-type': config.className,
              ...(idx === 0 ? { 'data-admonition-icon': config.icon, 'data-admonition-label': config.label || typeRaw } : {}),
            },
          }).range(line.from),
        );
      });
    },
  });

  return Decoration.set(decorations, true);
}

const admonitionTheme = EditorView.theme({
  '.cm-admonition': {
    borderLeft: '4px solid var(--admonition-color, rgba(127, 127, 127, 0.5))',
    paddingLeft: '12px',
    backgroundColor: 'var(--admonition-bg, rgba(127, 127, 127, 0.04))',
  },
  '.cm-admonition-title': {
    fontWeight: '600',
  },
  '.cm-admonition-title::before': {
    content: 'attr(data-admonition-icon) " " attr(data-admonition-label) " — "',
    marginRight: '4px',
    fontWeight: '700',
  },
  '.cm-admonition-note': {
    '--admonition-color': '#1e88e5',
    '--admonition-bg': 'rgba(30, 136, 229, 0.06)',
  },
  '.cm-admonition-tip': {
    '--admonition-color': '#43a047',
    '--admonition-bg': 'rgba(67, 160, 71, 0.06)',
  },
  '.cm-admonition-important': {
    '--admonition-color': '#7b1fa2',
    '--admonition-bg': 'rgba(123, 31, 162, 0.06)',
  },
  '.cm-admonition-warning': {
    '--admonition-color': '#fb8c00',
    '--admonition-bg': 'rgba(251, 140, 0, 0.06)',
  },
  '.cm-admonition-caution': {
    '--admonition-color': '#e53935',
    '--admonition-bg': 'rgba(229, 57, 53, 0.06)',
  },
  '.cm-admonition-info': {
    '--admonition-color': '#039be5',
    '--admonition-bg': 'rgba(3, 155, 229, 0.06)',
  },
  '.cm-admonition-success': {
    '--admonition-color': '#43a047',
    '--admonition-bg': 'rgba(67, 160, 71, 0.06)',
  },
  '.cm-admonition-question': {
    '--admonition-color': '#fb8c00',
    '--admonition-bg': 'rgba(251, 140, 0, 0.06)',
  },
  '.cm-admonition-failure, .cm-admonition-danger, .cm-admonition-bug': {
    '--admonition-color': '#e53935',
    '--admonition-bg': 'rgba(229, 57, 53, 0.06)',
  },
  '.cm-admonition-example': {
    '--admonition-color': '#7e57c2',
    '--admonition-bg': 'rgba(126, 87, 194, 0.06)',
  },
  '.cm-admonition-quote': {
    '--admonition-color': '#757575',
    '--admonition-bg': 'rgba(117, 117, 117, 0.06)',
  },
  '.cm-admonition-default': {
    '--admonition-color': '#757575',
    '--admonition-bg': 'rgba(117, 117, 117, 0.04)',
  },
});

export function createAdmonitionExtension(options: AdmonitionOptions = {}): Extension {
  const types = options.types ?? GFM_TYPES;

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildAdmonitionDecorations(state, types);
    },
    update(deco, tr) {
      if (tr.docChanged || tr.reconfigured) {
        return buildAdmonitionDecorations(tr.state, types);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [admonitionTheme, field];
}
