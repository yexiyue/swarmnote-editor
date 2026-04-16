/**
 * Block Image Rendering
 *
 * 将独占一行的 `![alt](url)` 渲染为实际的 <img> 元素。
 * 当光标在图片所在行时，显示原始 Markdown 文本。
 *
 * 参考 Joplin renderBlockImages.ts，简化为只处理标准 Markdown 图像。
 *
 * CM6 要求 block 级 decoration 必须来自 StateField（不能来自 ViewPlugin），
 * 所以装饰的构建接收 `EditorState` 而非 `EditorView`，不再做 viewport 裁剪。
 */
import { ensureSyntaxTree } from '@codemirror/language';
import {
  type EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import { Decoration, type DecorationSet, EditorView, WidgetType } from '@codemirror/view';

const imageClassName = 'cm-md-image';

export type ImageResolver = (src: string) => string | Promise<string>;

export interface BlockImageOptions {
  /**
   * Optional resolver invoked with the raw `src` from `![alt](src)`. Return
   * the URL that should be assigned to `<img src>`. Useful for mapping
   * workspace-relative paths to platform-specific protocols (e.g. Tauri
   * `asset://`). May return a Promise — widgets render placeholder height
   * until resolution completes.
   */
  resolver?: ImageResolver;
  /** Max retry attempts after image load failure. Defaults to 3. */
  maxLoadAttempts?: number;
}

/**
 * Dispatch this effect to force rebuild of all block image decorations
 * (re-invokes the resolver). Use when upstream assets have been refreshed
 * (e.g. after P2P sync of binary media).
 *
 * ```ts
 * view.dispatch({ effects: refreshBlockImagesEffect.of(null) });
 * ```
 */
export const refreshBlockImagesEffect = StateEffect.define<null>();


class ImageHeightCache {
  private readonly cache = new Map<string, number>();
  private readonly maxEntries = 500;

  get(key: string): number | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: string, height: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, height);
  }
}

const heightCache = new ImageHeightCache();


class ImageWidget extends WidgetType {
  constructor(
    private readonly rawSrc: string,
    private readonly alt: string,
    private readonly resolver: ImageResolver | undefined,
    private readonly maxLoadAttempts: number,
    /** Refresh generation — different values produce non-equal widgets. */
    private readonly tick: number,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      this.rawSrc === other.rawSrc &&
      this.alt === other.alt &&
      this.resolver === other.resolver &&
      this.tick === other.tick
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.classList.add(imageClassName);

    const cached = heightCache.get(this.rawSrc);
    if (cached) {
      container.style.minHeight = `${cached}px`;
    }

    const img = document.createElement('img');
    img.alt = this.alt;

    let attempt = 0;
    let fallbackNode: HTMLElement | null = null;
    const rawSrc = this.rawSrc;
    const resolver = this.resolver;
    const maxAttempts = this.maxLoadAttempts;

    const resolveAndAssign = async () => {
      if (fallbackNode && fallbackNode.isConnected) {
        fallbackNode.remove();
        fallbackNode = null;
        img.style.display = '';
      }
      try {
        const resolved = resolver ? await resolver(rawSrc) : rawSrc;
        if (!container.isConnected) return;
        img.src = resolved;
      } catch {
        if (!container.isConnected) return;
        img.src = rawSrc;
      }
    };

    img.onload = () => {
      if (container.isConnected) {
        heightCache.set(rawSrc, container.offsetHeight);
      }
      container.style.minHeight = '';
      attempt = 0;
    };

    img.onerror = () => {
      if (!container.isConnected) return;
      attempt += 1;
      if (attempt <= maxAttempts) {
        const delay = 2 ** (attempt - 1) * 500; // 500ms, 1s, 2s
        setTimeout(() => {
          if (container.isConnected) resolveAndAssign();
        }, delay);
        return;
      }
      container.style.minHeight = '';
      img.style.display = 'none';
      const fallback = document.createElement('span');
      fallback.className = `${imageClassName}-fallback`;
      fallback.textContent = this.alt || 'Image failed to load';
      container.appendChild(fallback);
      fallbackNode = fallback;
    };

    resolveAndAssign();
    container.appendChild(img);

    // Click → move cursor to image line
    container.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const pos = Math.min(view.posAtDOM(container), view.state.doc.length);
      view.dispatch({
        selection: { anchor: view.state.doc.lineAt(pos).from },
        scrollIntoView: false,
      });
    });

    return container;
  }

  get estimatedHeight() {
    return heightCache.get(this.rawSrc) ?? -1;
  }

  ignoreEvent() {
    return true;
  }
}


const blockImageTheme = EditorView.theme({
  [`& .${imageClassName}`]: {
    padding: '4px 0',
  },
  [`& .${imageClassName} > img`]: {
    maxWidth: '100%',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    borderRadius: '4px',
  },
  [`& .${imageClassName}-fallback`]: {
    display: 'block',
    padding: '8px 12px',
    color: 'rgba(127, 127, 127, 0.8)',
    fontStyle: 'italic',
    fontSize: '0.9em',
  },
});


interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
}

function buildDecorations(
  state: EditorState,
  resolver: ImageResolver | undefined,
  maxAttempts: number,
  tick: number,
): DecorationSet {
  const entries: DecorationEntry[] = [];
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;

  const tree = ensureSyntaxTree(state, state.doc.length, 500);
  if (!tree) return Decoration.none;

  tree.iterate({
    enter(node) {
      if (node.name !== 'Image') return;

      const lineFrom = state.doc.lineAt(node.from);
      const lineTo = state.doc.lineAt(node.to);

      // Only render block-level images (alone on a line)
      const textBefore = state.sliceDoc(lineFrom.from, node.from);
      const textAfter = state.sliceDoc(node.to, lineTo.to);
      if (textBefore.trim() !== '' || textAfter.trim() !== '') return;

      // Reveal when cursor is on this line
      if (cursorLine >= lineFrom.number && cursorLine <= lineTo.number) return;

      // Parse ![alt](url)
      const nodeText = state.sliceDoc(node.from, node.to);
      const match = nodeText.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (!match) return;

      const alt = match[1];
      const src = match[2];

      entries.push({
        from: lineFrom.from,
        to: lineTo.to,
        decoration: Decoration.replace({
          widget: new ImageWidget(src, alt, resolver, maxAttempts, tick),
          block: true,
        }),
      });
    },
  });

  entries.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.decoration);
  }
  return builder.finish();
}

export function createBlockImageExtension(options: BlockImageOptions = {}): Extension {
  const resolver = options.resolver;
  const maxAttempts = options.maxLoadAttempts ?? 3;

  // A mutable refresh counter — shared across StateField transactions, bumped
  // whenever `refreshBlockImagesEffect` is dispatched. Stamping it into widget
  // identity forces a re-render even when the document itself is unchanged.
  let tick = 0;

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, resolver, maxAttempts, tick);
    },
    update(deco, tr) {
      const hasRefresh = tr.effects.some((e) => e.is(refreshBlockImagesEffect));
      if (hasRefresh) {
        tick += 1;
        return buildDecorations(tr.state, resolver, maxAttempts, tick);
      }
      if (tr.docChanged || tr.selection) {
        return buildDecorations(tr.state, resolver, maxAttempts, tick);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [blockImageTheme, field];
}
