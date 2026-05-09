/**
 * Admonition / callout block rendering — Obsidian-style.
 *
 * Recognizes GFM-style `> [!type] Title` and Obsidian-pre-callout `> **type**
 * Title` syntax inside Blockquote nodes. Renders a styled callout box with:
 *   - Filled background tinted by type color
 *   - Rounded corners + colored left accent bar
 *   - Header row: Lucide SVG icon + bold label (custom title overrides label)
 *   - Source markdown `> [!type] ...` is hidden when cursor is off the title
 *     line; reveal on cursor entry, restore on exit
 *
 * Type lookup is case-insensitive. Unknown types fall back to a neutral
 * default — imported Obsidian vaults with custom callouts won't fail to render.
 */
import { syntaxTree } from '@codemirror/language';
import { type EditorState, type Extension, type Range, StateField } from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';
import { DEFAULT_ADMONITION_TYPE, GFM_TYPES } from './presets';
import type { AdmonitionTypeConfig, AdmonitionTypesMap } from './types';

// `[ \t]*` instead of `\s*` — `\s` would match `\n` and let the trailing `(.*)`
// greedily capture the next line as a "custom title" (yielding e.g.
// `customTitle = "> body content"` and the widget rendering body text as the
// header label). Restricting to spaces and tabs keeps the match on line 1.
const ADMONITION_REGEX =
  /^>[ \t]*(?:\*{2}|\[!)([a-zA-Z][a-zA-Z0-9_-]*)(?:\*{2}|\])[ \t]*(.*)/;

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


/**
 * Title-line widget — replaces the raw `> [!TYPE] custom-title?` source with
 * a self-contained block element carrying its own background / border-radius
 * / padding (same admonition tokens as body lines). Block-level so the line
 * is fully owned by the widget — no fragile interaction with line-decoration
 * reconciliation when the cursor enters and leaves the block.
 */
class AdmonitionTitleWidget extends WidgetType {
  constructor(
    private readonly iconSvg: string,
    private readonly labelText: string,
    private readonly className: string,
    /** If the title line is also the last line (single-line callout). */
    private readonly isOnly: boolean,
  ) {
    super();
  }

  eq(other: AdmonitionTitleWidget) {
    return (
      this.iconSvg === other.iconSvg &&
      this.labelText === other.labelText &&
      this.className === other.className &&
      this.isOnly === other.isOnly
    );
  }

  toDOM() {
    const root = document.createElement('div');
    root.className = `cm-admonition cm-admonition-title cm-admonition-${this.className}`;
    if (this.isOnly) root.classList.add('cm-admonition-only');
    root.setAttribute('data-admonition-type', this.className);

    const inner = document.createElement('div');
    inner.className = 'cm-admonition-title-widget';

    const iconWrap = document.createElement('span');
    iconWrap.className = 'cm-admonition-title-icon';
    iconWrap.innerHTML = this.iconSvg;
    inner.appendChild(iconWrap);

    const labelEl = document.createElement('span');
    labelEl.className = 'cm-admonition-title-label';
    labelEl.textContent = this.labelText;
    inner.appendChild(labelEl);

    root.appendChild(inner);
    return root;
  }

  ignoreEvent() {
    // Allow CM6 to handle clicks → cursor lands on the title line → block
    // switches to source mode (see `cursorLineNum` check in buildDecorations).
    return false;
  }
}


function buildAdmonitionDecorations(
  state: EditorState,
  types: AdmonitionTypesMap,
): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const cursorLineNum = state.doc.lineAt(state.selection.main.head).number;

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name !== 'Blockquote') return;

      const rawText = state.sliceDoc(node.from, node.to);
      const match = ADMONITION_REGEX.exec(rawText);
      if (!match) return;

      // Walk actual document lines covered by this Blockquote node — simpler
      // and unambiguous compared to splitting on /\n>/ and re-deriving offsets.
      const startLineNum = state.doc.lineAt(node.from).number;
      const endLineNum = state.doc.lineAt(node.to).number;

      // Obsidian-style "click anywhere → whole block becomes source": when
      // the cursor sits anywhere inside this admonition block, emit no
      // decorations at all. The result is plain `> [!type] / > body...`
      // markdown with the editor's default blockquote styling — fully
      // editable. Click outside (cursor leaves the block) → render restored.
      if (cursorLineNum >= startLineNum && cursorLineNum <= endLineNum) return;

      const typeRaw = match[1];
      const customTitle = match[2].trim();
      const { config } = lookupType(types, typeRaw);
      const baseClass = `cm-admonition cm-admonition-${config.className}`;
      const isOnly = startLineNum === endLineNum;
      const labelText = customTitle || config.label || typeRaw;

      // Title — block-level replace. Widget DOM carries its own admonition
      // classes so we don't rely on Decoration.line + Decoration.replace
      // overlap reconciliation, which proved fragile when entering/leaving
      // source mode.
      const titleLine = state.doc.line(startLineNum);
      decorations.push(
        Decoration.replace({
          widget: new AdmonitionTitleWidget(config.icon, labelText, config.className, isOnly),
          block: true,
        }).range(titleLine.from, titleLine.to),
      );

      // Body lines — line decoration only.
      for (let n = startLineNum + 1; n <= endLineNum; n++) {
        const line = state.doc.line(n);
        const isLast = n === endLineNum;
        const bodyClasses = [
          baseClass,
          'cm-admonition-body',
          isLast ? 'cm-admonition-body-last' : '',
        ]
          .filter(Boolean)
          .join(' ');
        decorations.push(
          Decoration.line({
            class: bodyClasses,
            attributes: { 'data-admonition-type': config.className },
          }).range(line.from),
        );
      }
    },
  });

  return Decoration.set(decorations, true);
}

const admonitionTheme = EditorView.theme({
  // Per-type accent color (used by background, left bar, icon stroke).
  '.cm-admonition-note': { '--admonition-color': '#1e88e5' },
  '.cm-admonition-tip': { '--admonition-color': '#43a047' },
  '.cm-admonition-important': { '--admonition-color': '#7b1fa2' },
  '.cm-admonition-warning': { '--admonition-color': '#fb8c00' },
  '.cm-admonition-caution': { '--admonition-color': '#e53935' },
  '.cm-admonition-info': { '--admonition-color': '#039be5' },
  '.cm-admonition-success': { '--admonition-color': '#43a047' },
  '.cm-admonition-question': { '--admonition-color': '#fb8c00' },
  '.cm-admonition-failure, .cm-admonition-danger, .cm-admonition-bug': {
    '--admonition-color': '#e53935',
  },
  '.cm-admonition-example': { '--admonition-color': '#7e57c2' },
  '.cm-admonition-quote': { '--admonition-color': '#757575' },
  '.cm-admonition-default': { '--admonition-color': '#757575' },

  // Each line gets the tinted fill — combined across the block they form a
  // continuous rounded box (Obsidian-style; no left accent bar). Padding is
  // on the line so cursor positioning behaves naturally; rounding lives on
  // first / last line of the block.
  //
  // `background-image: none !important` is critical: `markdownDecorationExtension`
  // also adds a `cm-blockQuote-d0` class that draws a 2px gold vertical bar
  // via `background-image: linear-gradient(...)`. backgroundColor and
  // backgroundImage are independent CSS properties — without explicitly
  // clearing the image, the blockquote bar would still render through our
  // tinted fill.
  '.cm-admonition': {
    backgroundColor: 'color-mix(in srgb, var(--admonition-color) 10%, transparent)',
    backgroundImage: 'none !important',
    paddingLeft: '14px !important',
    paddingRight: '14px !important',
    paddingTop: '0',
    paddingBottom: '0',
  },
  '.cm-admonition-title': {
    paddingTop: '10px !important',
    paddingBottom: '4px !important',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px',
  },
  '.cm-admonition-only, .cm-admonition-body-last': {
    paddingBottom: '10px !important',
    borderBottomLeftRadius: '6px',
    borderBottomRightRadius: '6px',
  },

  // Header widget — flex row with icon + bold label, accent-colored.
  '.cm-admonition-title-widget': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    color: 'var(--admonition-color)',
    fontWeight: '600',
    fontSize: '0.95em',
    lineHeight: '1.4',
    letterSpacing: '0.01em',
  },
  '.cm-admonition-title-icon': {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: '0',
  },
  '.cm-admonition-title-icon > svg': {
    display: 'block',
  },
  '.cm-admonition-title-label': {
    color: 'var(--admonition-color)',
  },
});

export function createAdmonitionExtension(options: AdmonitionOptions = {}): Extension {
  const types = options.types ?? GFM_TYPES;

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildAdmonitionDecorations(state, types);
    },
    update(deco, tr) {
      if (tr.docChanged || tr.reconfigured || tr.selection) {
        return buildAdmonitionDecorations(tr.state, types);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [admonitionTheme, field];
}
