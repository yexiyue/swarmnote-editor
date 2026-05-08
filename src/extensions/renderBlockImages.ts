/**
 * Block Image Rendering — Obsidian-style interaction
 *
 * 将独占一行的 `![alt](url)` 渲染为实际的 <img> 元素。
 *
 * 交互模型（对齐 Obsidian）：
 *   - 默认：`Decoration.replace`，源码行被图片 widget 替换，仅渲染图片
 *   - 点击图片：选中（边框 + 右上角 `</>` 图标），不移动光标
 *   - 点击图标：把光标送进图片所在行 → 切到「源 + 图共显」模式
 *   - 光标在图片行（含图标点击触发）：使用 `Decoration.widget`(side:1) 把图片
 *     追加到行尾，源码行同时可见可编辑
 *   - 光标离开 / 点击别处 / Esc：自动退出选中态
 *
 * CM6 要求 block 级 decoration 必须来自 StateField（不能来自 ViewPlugin）。
 */
import { ensureSyntaxTree } from '@codemirror/language';
import {
  type EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from '@codemirror/state';
import {
  Decoration,
  type DecorationSet,
  EditorView,
  WidgetType,
  keymap,
} from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import { editorEventCallback, EditorEventType } from '../events';

const imageClassName = 'cm-md-image';

/**
 * Frozen CSS class-name table — single source of truth for every selector
 * referenced by both `EditorView.theme()` and the imperative DOM in widgets.
 * A typo here is a compile-time error; a typo in a raw string was a silent
 * styling bug.
 */
const CLS = {
  block: imageClassName,
  frame: `${imageClassName}-frame`,
  selected: `${imageClassName}-selected`,
  sourceVisible: `${imageClassName}-source-visible`,
  sourceBtn: `${imageClassName}-source-btn`,
  linked: `${imageClassName}-linked`,
  linkBtn: `${imageClassName}-link-btn`,
  fallback: `${imageClassName}-fallback`,
  inline: `${imageClassName}-inline`,
  inlineImg: `${imageClassName}-inline-img`,
  inlineFallback: `${imageClassName}-inline-fallback`,
  inlineLinked: `${imageClassName}-inline-linked`,
  inlineLinkBadge: `${imageClassName}-inline-link-badge`,
} as const;


/**
 * Strip CommonMark title delimiters (`"..."` / `'...'` / `(...)`) from a
 * pre-trimmed string. Returns `null` if the input is not wrapped — caller
 * decides whether that means "no title" or to fall back to the raw text.
 */
function stripWrappingQuotes(raw: string): string | null {
  if (raw.length < 2) return null;
  const first = raw[0];
  const last = raw[raw.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return raw.slice(1, -1);
  }
  if (first === '(' && last === ')') {
    return raw.slice(1, -1);
  }
  return null;
}

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
 */
export const refreshBlockImagesEffect = StateEffect.define<null>();

/**
 * Internal effect — sets the currently selected block image to the given
 * line.from offset, or null to clear. Click on widget dispatches with the
 * line.from; selection moving off the image line auto-clears.
 */
const setSelectedImageEffect = StateEffect.define<number | null>();

const selectedImageField = StateField.define<number | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSelectedImageEffect)) return effect.value;
    }
    if (tr.docChanged) return null;
    if (tr.selection && value !== null) {
      const head = tr.state.selection.main.head;
      const headLineFrom = tr.state.doc.lineAt(head).from;
      if (headLineFrom !== value) return null;
    }
    return value;
  },
});


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


const SOURCE_ICON_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>`;

// External-link / "open in new" icon — same Lucide style as SOURCE_ICON_SVG.
const EXTLINK_ICON_SVG = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"></path><path d="M10 14L21 3"></path><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path></svg>`;


/**
 * Parse the text of a lezer-markdown `Image` node into `{ alt, src, title }`.
 *
 * Handles:
 *   - `![alt](url)`
 *   - `![alt](url "title")` / `'title'` / `(title)`
 *   - `![alt](<url with spaces>)` (angle-bracketed src)
 *   - `![alt](<url> "title")`
 *
 * Returns `null` if the text does not look like a valid image expression
 * (lezer should have already validated, but we re-check defensively).
 */
function parseImageMarkdown(
  text: string,
): { alt: string; src: string; title: string } | null {
  if (!text.startsWith('![') || !text.endsWith(')')) return null;
  const altEnd = text.indexOf('](', 2);
  if (altEnd === -1) return null;

  const alt = text.slice(2, altEnd);
  const inside = text.slice(altEnd + 2, -1).trim();

  let src: string;
  let rest: string;

  if (inside.startsWith('<')) {
    const close = inside.indexOf('>');
    if (close === -1) return null;
    src = inside.slice(1, close);
    rest = inside.slice(close + 1).trimStart();
  } else {
    const wsIdx = inside.search(/\s/);
    if (wsIdx === -1) {
      src = inside;
      rest = '';
    } else {
      src = inside.slice(0, wsIdx);
      rest = inside.slice(wsIdx + 1).trimStart();
    }
  }

  // Malformed trailing content is silently ignored — lezer flagged the node
  // as an Image, so the src is still rendered even if the title is not
  // extractable.
  const title = rest ? stripWrappingQuotes(rest) ?? '' : '';
  return { alt, src, title };
}


/**
 * Detect the `[![alt](img)](link)` pattern — markdown's "image as link".
 *
 * Lezer tree shape:
 *   Link
 *     LinkMark `[`
 *     Image          ← we're called when iterating this node
 *     LinkMark `]`
 *     LinkMark `(`
 *     URL            ← link's href
 *     LinkTitle?
 *     LinkMark `)`
 *
 * Returns null unless the Image is the immediate (and only) content inside
 * the Link's `[...]` brackets — i.e. classic markdown linked-image syntax.
 */
function getLinkedImageInfo(
  imageNode: SyntaxNode,
  state: EditorState,
): { linkFrom: number; linkTo: number; linkUrl: string; linkTitle: string } | null {
  const parent = imageNode.parent;
  if (!parent || parent.name !== 'Link') return null;
  // Image must start right after the `[` of the link.
  if (imageNode.from !== parent.from + 1) return null;

  const urlNode = parent.getChild('URL');
  const url = urlNode ? state.sliceDoc(urlNode.from, urlNode.to) : null;
  const titleNode = parent.getChild('LinkTitle');
  const title = titleNode
    ? stripWrappingQuotes(state.sliceDoc(titleNode.from, titleNode.to).trim()) ?? ''
    : '';
  if (!url) return null;
  return { linkFrom: parent.from, linkTo: parent.to, linkUrl: url, linkTitle: title };
}


/**
 * Dispatch a `LinkOpen` event through the editor's event callback facet
 * (the same channel used by `createCtrlClickLinksExtension`). The host
 * (NoteEditor.tsx) is responsible for actually opening the URL via
 * `@tauri-apps/plugin-opener`. Calling `window.open` directly is unreliable
 * inside a Tauri webview, so we go through the host instead.
 */
function dispatchLinkOpen(view: EditorView, url: string): void {
  const callback = view.state.facet(editorEventCallback);
  callback?.({ kind: EditorEventType.LinkOpen, url });
}


/**
 * Wire `<img>` async loading + exponential-backoff retry + permanent-failure
 * fallback. Block and inline variants only differ in the fallback DOM (append
 * vs. replace) and the optional success hook (height-cache only on block),
 * so those are caller-provided.
 */
interface ImageLoadingOpts {
  img: HTMLImageElement;
  rawSrc: string;
  resolver: ImageResolver | undefined;
  maxAttempts: number;
  /** True iff the widget DOM is still mounted; polled on each retry. */
  isAlive: () => boolean;
  /** Successful-load hook (e.g. record height in the cache). */
  onLoad?: () => void;
  /** Called once retries are exhausted; widget should swap in a fallback. */
  onPermanentFail: () => void;
}

function attachImageLoading(opts: ImageLoadingOpts): void {
  const { img, rawSrc, resolver, maxAttempts, isAlive, onLoad, onPermanentFail } = opts;
  let attempt = 0;

  const resolve = async () => {
    try {
      const resolved = resolver ? await resolver(rawSrc) : rawSrc;
      if (!isAlive()) return;
      img.src = resolved;
    } catch {
      if (!isAlive()) return;
      img.src = rawSrc;
    }
  };

  if (onLoad) {
    img.onload = () => {
      attempt = 0;
      onLoad();
    };
  }

  img.onerror = () => {
    if (!isAlive()) return;
    attempt += 1;
    if (attempt <= maxAttempts) {
      // 500ms, 1s, 2s, 4s, ...
      setTimeout(() => {
        if (isAlive()) resolve();
      }, 2 ** (attempt - 1) * 500);
      return;
    }
    onPermanentFail();
  };

  resolve();
}


/**
 * Build the external-link badge that overlays linked images. Block (icon
 * button on top-right of the image frame) and inline (small badge on top-
 * right of the inline `<img>`) share identical click semantics — they only
 * differ in the wrapper class and tag.
 */
/** Convert a DOM element back to its containing line (clamped to doc end). */
function lineAtDOM(view: EditorView, el: HTMLElement) {
  const pos = view.posAtDOM(el);
  if (pos < 0) return null;
  return view.state.doc.lineAt(Math.min(pos, view.state.doc.length));
}


function makeLinkBadge(
  view: EditorView,
  linkUrl: string,
  linkTitle: string | undefined,
  className: string,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.title = linkTitle ? `${linkTitle}\n${linkUrl}` : linkUrl;
  btn.setAttribute('aria-label', `Open link: ${linkUrl}`);
  btn.innerHTML = EXTLINK_ICON_SVG;
  btn.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dispatchLinkOpen(view, linkUrl);
  });
  return btn;
}


class ImageWidget extends WidgetType {
  constructor(
    private readonly rawSrc: string,
    private readonly alt: string,
    private readonly title: string,
    private readonly resolver: ImageResolver | undefined,
    private readonly maxLoadAttempts: number,
    /** Refresh generation — different values produce non-equal widgets. */
    private readonly tick: number,
    /** Whether this image is currently the user-selected one. */
    private readonly selected: boolean,
    /** Whether the source line is also visible (cursor-on-line / show-source mode). */
    private readonly sourceVisible: boolean,
    /** If the image is wrapped in a markdown link `[![](img)](href)`. */
    private readonly linkUrl: string | undefined,
    private readonly linkTitle: string | undefined,
  ) {
    super();
  }

  eq(other: ImageWidget) {
    return (
      this.rawSrc === other.rawSrc &&
      this.alt === other.alt &&
      this.title === other.title &&
      this.resolver === other.resolver &&
      this.tick === other.tick &&
      this.selected === other.selected &&
      this.sourceVisible === other.sourceVisible &&
      this.linkUrl === other.linkUrl &&
      this.linkTitle === other.linkTitle
    );
  }

  toDOM(view: EditorView) {
    const container = document.createElement('div');
    container.classList.add(CLS.block);
    if (this.selected) container.classList.add(CLS.selected);
    if (this.sourceVisible) container.classList.add(CLS.sourceVisible);
    if (this.linkUrl) container.classList.add(CLS.linked);

    const frame = document.createElement('span');
    frame.className = CLS.frame;

    const cached = heightCache.get(this.rawSrc);
    if (cached) frame.style.minHeight = `${cached}px`;

    const img = document.createElement('img');
    img.alt = this.alt;
    if (this.title) img.title = this.title;
    img.draggable = false;

    attachImageLoading({
      img,
      rawSrc: this.rawSrc,
      resolver: this.resolver,
      maxAttempts: this.maxLoadAttempts,
      isAlive: () => container.isConnected,
      onLoad: () => {
        if (frame.isConnected) heightCache.set(this.rawSrc, frame.offsetHeight);
        frame.style.minHeight = '';
      },
      onPermanentFail: () => {
        frame.style.minHeight = '';
        img.style.display = 'none';
        const fallback = document.createElement('span');
        fallback.className = CLS.fallback;
        fallback.textContent = this.alt || 'Image failed to load';
        frame.appendChild(fallback);
      },
    });
    frame.appendChild(img);

    const sourceBtn = document.createElement('button');
    sourceBtn.type = 'button';
    sourceBtn.className = CLS.sourceBtn;
    sourceBtn.title = 'Show markdown source';
    sourceBtn.setAttribute('aria-label', 'Show markdown source');
    sourceBtn.innerHTML = SOURCE_ICON_SVG;
    sourceBtn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const line = lineAtDOM(view, container);
      if (!line) return;
      view.dispatch({
        selection: { anchor: line.from },
        effects: setSelectedImageEffect.of(null),
        scrollIntoView: false,
      });
      view.focus();
    });
    frame.appendChild(sourceBtn);

    if (this.linkUrl) {
      frame.appendChild(makeLinkBadge(view, this.linkUrl, this.linkTitle, CLS.linkBtn));
    }

    frame.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.linkUrl && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        e.stopPropagation();
        dispatchLinkOpen(view, this.linkUrl);
        return;
      }
      if (this.sourceVisible) return;
      e.preventDefault();
      const line = lineAtDOM(view, container);
      if (!line) return;
      view.dispatch({ effects: setSelectedImageEffect.of(line.from) });
    });

    container.appendChild(frame);
    return container;
  }

  get estimatedHeight() {
    return heightCache.get(this.rawSrc) ?? -1;
  }

  ignoreEvent() {
    return true;
  }
}


/**
 * Inline image widget — used for any `![alt](url)` that is **not** alone on
 * its line (e.g. inside text, inside a heading, inside emphasis, in a
 * blockquote / list / table cell, or one of multiple images on the same line).
 *
 * Behaviorally simpler than the block widget:
 *   - No selection state, no source-code icon (would be noise on small images)
 *   - Click positions cursor in [node.from, node.to] → buildDecorations skips
 *     emission → user sees raw markdown (standard inline live-preview reveal)
 */
class InlineImageWidget extends WidgetType {
  constructor(
    private readonly rawSrc: string,
    private readonly alt: string,
    private readonly title: string,
    private readonly resolver: ImageResolver | undefined,
    private readonly maxLoadAttempts: number,
    private readonly tick: number,
    private readonly linkUrl: string | undefined,
    private readonly linkTitle: string | undefined,
  ) {
    super();
  }

  eq(other: InlineImageWidget) {
    return (
      this.rawSrc === other.rawSrc &&
      this.alt === other.alt &&
      this.title === other.title &&
      this.resolver === other.resolver &&
      this.tick === other.tick &&
      this.linkUrl === other.linkUrl &&
      this.linkTitle === other.linkTitle
    );
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement('span');
    wrap.className = CLS.inline;
    if (this.linkUrl) wrap.classList.add(CLS.inlineLinked);

    const img = document.createElement('img');
    img.className = CLS.inlineImg;
    img.alt = this.alt;
    if (this.title) img.title = this.title;
    img.draggable = false;

    attachImageLoading({
      img,
      rawSrc: this.rawSrc,
      resolver: this.resolver,
      maxAttempts: this.maxLoadAttempts,
      isAlive: () => wrap.isConnected,
      onPermanentFail: () => {
        const fb = document.createElement('span');
        fb.className = CLS.inlineFallback;
        fb.textContent = this.alt || 'image';
        if (img.parentNode === wrap) wrap.replaceChild(fb, img);
      },
    });
    wrap.appendChild(img);

    if (this.linkUrl) {
      wrap.appendChild(makeLinkBadge(view, this.linkUrl, this.linkTitle, CLS.inlineLinkBadge));
    }

    return wrap;
  }

  ignoreEvent() {
    // Allow CM6 to handle clicks normally — clicking the inline image
    // positions the cursor at the widget boundary, which triggers reveal.
    return false;
  }
}


const blockImageTheme = EditorView.theme({
  // Default selection-border color tokens — overridable via createEditorTheme
  '&': {
    '--cm-image-selection-border': 'hsl(40, 72%, 46%)',
    '--cm-image-icon-fg': 'hsl(28, 10%, 14%)',
    '--cm-image-icon-bg': 'rgba(255, 255, 255, 0.92)',
    '--cm-image-icon-bg-hover': 'rgba(255, 255, 255, 1)',
    '--cm-image-icon-shadow': '0 1px 3px rgba(0, 0, 0, 0.18)',
  },
  [`& .${CLS.block}`]: {
    padding: '4px 0',
    display: 'flex',
    justifyContent: 'center',
  },
  [`& .${CLS.frame}`]: {
    position: 'relative',
    display: 'inline-block',
    maxWidth: '100%',
    borderRadius: '4px',
  },
  [`& .${CLS.frame} > img`]: {
    maxWidth: '100%',
    display: 'block',
    borderRadius: '4px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  [`& .${CLS.selected} .${CLS.frame}`]: {
    outline: '2px solid var(--cm-image-selection-border)',
    outlineOffset: '2px',
  },
  [`& .${CLS.sourceBtn}`]: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    padding: '0',
    margin: '0',
    background: 'var(--cm-image-icon-bg)',
    color: 'var(--cm-image-icon-fg)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: 'var(--cm-image-icon-shadow)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  [`& .${CLS.sourceBtn}:hover`]: {
    background: 'var(--cm-image-icon-bg-hover)',
  },
  [`& .${CLS.selected} .${CLS.sourceBtn}`]: {
    display: 'inline-flex',
  },
  // External-link button — bottom-right of a linked image. Always visible
  // (independent of selection), faded out a bit at rest, full-strength on
  // hover. Sized slightly smaller than the source-code button so the two
  // can coexist when an image is selected AND linked.
  [`& .${CLS.linkBtn}`]: {
    position: 'absolute',
    bottom: '6px',
    right: '6px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    padding: '0',
    margin: '0',
    background: 'var(--cm-image-icon-bg)',
    color: 'var(--cm-image-icon-fg)',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: 'var(--cm-image-icon-shadow)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    opacity: '0.85',
    transition: 'opacity 120ms ease',
  },
  [`& .${CLS.linkBtn}:hover`]: {
    opacity: '1',
    background: 'var(--cm-image-icon-bg-hover)',
  },
  [`& .${CLS.inlineLinked}`]: {
    position: 'relative',
  },
  [`& .${CLS.inlineLinkBadge}`]: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    background: 'var(--cm-image-icon-bg)',
    color: 'var(--cm-image-icon-fg)',
    borderRadius: '3px',
    boxShadow: 'var(--cm-image-icon-shadow)',
    cursor: 'pointer',
    pointerEvents: 'auto',
    opacity: '0.85',
  },
  [`& .${CLS.inlineLinkBadge}:hover`]: {
    opacity: '1',
    background: 'var(--cm-image-icon-bg-hover)',
  },
  [`& .${CLS.fallback}`]: {
    display: 'block',
    padding: '8px 12px',
    color: 'rgba(127, 127, 127, 0.8)',
    fontStyle: 'italic',
    fontSize: '0.9em',
  },
  [`& .${CLS.inline}`]: {
    display: 'inline-block',
    verticalAlign: 'middle',
    maxWidth: '100%',
    lineHeight: '0',
  },
  [`& .${CLS.inlineImg}`]: {
    maxWidth: '100%',
    maxHeight: 'var(--cm-image-inline-max-height, 320px)',
    display: 'inline-block',
    verticalAlign: 'middle',
    borderRadius: '3px',
  },
  [`& .${CLS.inlineFallback}`]: {
    display: 'inline-block',
    padding: '0 4px',
    color: 'rgba(127, 127, 127, 0.8)',
    fontStyle: 'italic',
    fontSize: '0.9em',
    verticalAlign: 'middle',
  },
  '&.cm-editor.cm-dark': {
    '--cm-image-selection-border': 'hsl(40, 72%, 52%)',
    '--cm-image-icon-fg': 'hsl(36, 10%, 93%)',
    '--cm-image-icon-bg': 'rgba(36, 36, 36, 0.92)',
    '--cm-image-icon-bg-hover': 'rgba(48, 48, 48, 1)',
    '--cm-image-icon-shadow': '0 1px 3px rgba(0, 0, 0, 0.4)',
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
  const head = state.selection.main.head;
  const cursorLine = state.doc.lineAt(head).number;
  const selectedLineFrom = state.field(selectedImageField, false) ?? null;

  const tree = ensureSyntaxTree(state, state.doc.length, 500);
  if (!tree) return Decoration.none;

  tree.iterate({
    enter(node) {
      if (node.name !== 'Image') return;

      // If this image is wrapped in a markdown link `[![](img)](href)`,
      // expand the effective range to cover the whole link, and pass the
      // link URL down to the widget so it can render a link badge + handle
      // Ctrl-click navigation. Otherwise effective range == image range.
      const linkInfo = getLinkedImageInfo(node.node, state);
      const effFrom = linkInfo ? linkInfo.linkFrom : node.from;
      const effTo = linkInfo ? linkInfo.linkTo : node.to;
      const linkUrl = linkInfo?.linkUrl;
      const linkTitle = linkInfo?.linkTitle;

      const lineFrom = state.doc.lineAt(effFrom);
      const lineTo = state.doc.lineAt(effTo);

      // Parse ![alt](src "title?") — supports bracketed src and all CommonMark title styles
      const nodeText = state.sliceDoc(node.from, node.to);
      const parsed = parseImageMarkdown(nodeText);
      if (!parsed) return;

      // "Block-solo" = nothing else on the line(s) (apart from the link/image
      // itself). Block-solo images get the centered/large rendering. Anything
      // else (heading, emphasis, blockquote prefix, list prefix, table cell,
      // multiple images on one line) → inline rendering.
      const textBefore = state.sliceDoc(lineFrom.from, effFrom);
      const textAfter = state.sliceDoc(effTo, lineTo.to);
      const isBlockSolo = textBefore.trim() === '' && textAfter.trim() === '';

      if (isBlockSolo) {
        const sourceVisible =
          cursorLine >= lineFrom.number && cursorLine <= lineTo.number;
        const selected = selectedLineFrom === lineFrom.from;

        const widget = new ImageWidget(
          parsed.src,
          parsed.alt,
          parsed.title,
          resolver,
          maxAttempts,
          tick,
          selected,
          sourceVisible,
          linkUrl,
          linkTitle,
        );

        if (sourceVisible) {
          // Image rendered AFTER the source line — both visible, line editable.
          entries.push({
            from: lineTo.to,
            to: lineTo.to,
            decoration: Decoration.widget({ widget, block: true, side: 1 }),
          });
        } else {
          entries.push({
            from: lineFrom.from,
            to: lineTo.to,
            decoration: Decoration.replace({ widget, block: true }),
          });
        }
        return;
      }

      // Inline path — skip emission when cursor is inside the effective
      // (link OR image) range so the user sees the raw markdown source.
      if (head >= effFrom && head <= effTo) return;

      const inlineWidget = new InlineImageWidget(
        parsed.src,
        parsed.alt,
        parsed.title,
        resolver,
        maxAttempts,
        tick,
        linkUrl,
        linkTitle,
      );
      entries.push({
        from: effFrom,
        to: effTo,
        decoration: Decoration.replace({ widget: inlineWidget }),
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

  const decorationField = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, resolver, maxAttempts, tick);
    },
    update(deco, tr) {
      const hasRefresh = tr.effects.some((e) => e.is(refreshBlockImagesEffect));
      if (hasRefresh) {
        tick += 1;
        return buildDecorations(tr.state, resolver, maxAttempts, tick);
      }
      const selectionChanged = tr.effects.some((e) => e.is(setSelectedImageEffect));
      if (tr.docChanged || tr.selection || selectionChanged) {
        return buildDecorations(tr.state, resolver, maxAttempts, tick);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  // Esc clears any active image selection.
  const escapeKeymap = keymap.of([
    {
      key: 'Escape',
      run: (view) => {
        if (view.state.field(selectedImageField, false) === null) return false;
        view.dispatch({ effects: setSelectedImageEffect.of(null) });
        return true;
      },
    },
  ]);

  return [blockImageTheme, selectedImageField, decorationField, escapeKeymap];
}
