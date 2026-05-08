/**
 * Raw HTML Rendering — Obsidian/Typora-style native HTML support
 *
 * 把 markdown 中的原生 HTML（lezer `HTMLBlock` 与 self-closing `HTMLTag`）渲染
 * 为实际 DOM。所有 HTML 都先经过 DOMPurify 清洗（剥离 `<script>` / `on*` 事件 /
 * `javascript:` URL 等），然后通过 `innerHTML` 注入到 widget 容器中。
 *
 * 行为：
 *   - HTMLBlock：渲染为 block widget，Decoration.replace 替换整段
 *   - 自闭合 HTMLTag（`<img/>`, `<br/>`, `<hr/>` 等 void 元素）：渲染为 inline widget
 *   - 配对 HTMLTag（`<span>...</span>`）：暂不接管，留给现有 inlineRendering 系统
 *   - 光标进入节点范围 → 跳过 emission，源码可见可编辑
 *
 * `<img>` 与 `<source>` 的相对路径 `src` / `srcset` 会通过同一个 imageResolver
 * 异步解析（与 `![]()` 保持一致），保证 workspace-relative 路径在 Tauri 下能加载。
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
import DOMPurify, { type Config as DOMPurifyConfig } from 'dompurify';
import type { SyntaxNode } from '@lezer/common';
import { editorEventCallback, EditorEventType } from '../events';
import type { ImageResolver } from './renderBlockImages';

const rawHtmlClassName = 'cm-md-html';

export interface RawHtmlOptions {
  resolver?: ImageResolver;
}

/**
 * Force-rebuild HTML widgets (e.g. after media sync brings new asset bytes).
 * Mirrors `refreshBlockImagesEffect` — different tick → widgets `eq` returns
 * false → `toDOM` re-runs.
 */
export const refreshRawHtmlEffect = StateEffect.define<null>();

// HTML void (self-closing) elements — render as inline widget.
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const purifyConfig: DOMPurifyConfig = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true },
  // Block dangerous tags that DOMPurify would otherwise leave alone in some configs
  FORBID_TAGS: ['script', 'iframe', 'form', 'input', 'button', 'object', 'embed'],
  // Drop event handlers and high-risk attributes
  FORBID_ATTR: [
    'formaction',
    'srcdoc',
    'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout',
    'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onchange',
    'onsubmit', 'oninput', 'onauxclick', 'oncontextmenu',
  ],
  ALLOW_DATA_ATTR: false,
};

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, purifyConfig) as unknown as string;
}

/**
 * Walk the rendered subtree and asynchronously resolve `src` / `srcset` of
 * `<img>` and `<source>` elements via the supplied resolver. Skip URLs that
 * already use a recognized scheme (http/https/data/blob/asset/tauri/file).
 */
function resolveMediaSources(root: ParentNode, resolver: ImageResolver): void {
  const imgs = root.querySelectorAll('img');
  imgs.forEach(async (img) => {
    const src = img.getAttribute('src');
    if (!src || /^(https?|data|blob|asset|tauri|file):/i.test(src)) return;
    try {
      const resolved = await resolver(src);
      if (img.isConnected) img.setAttribute('src', resolved);
    } catch {
      /* leave original */
    }
  });
  const sources = root.querySelectorAll('source');
  sources.forEach(async (source) => {
    const srcset = source.getAttribute('srcset');
    if (!srcset || /^(https?|data|blob|asset|tauri|file):/i.test(srcset)) return;
    try {
      const resolved = await resolver(srcset);
      if (source.isConnected) source.setAttribute('srcset', resolved);
    } catch {
      /* leave original */
    }
  });
}


/**
 * Intercept clicks on `<a>` inside the widget. Plain click is swallowed so
 * a stray click doesn't navigate the whole Tauri webview away; Ctrl/Cmd-click
 * dispatches a `LinkOpen` event through the editor's facet (same channel as
 * `ctrlClickLinksExtension`), which the host opens via plugin-opener.
 */
function attachLinkInterceptor(root: HTMLElement, view: EditorView): void {
  root.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement | null)?.closest?.('a') as
      | HTMLAnchorElement
      | null;
    if (!target) return;
    e.preventDefault();
    if (!(e.ctrlKey || e.metaKey)) return;
    const href = target.getAttribute('href');
    if (!href) return;
    const callback = view.state.facet(editorEventCallback);
    callback?.({ kind: EditorEventType.LinkOpen, url: href });
  });
}


/**
 * Single widget for both block-level (HTMLBlock → `<div>`) and self-closing
 * inline (HTMLTag void element → `<span>`) raw-HTML rendering. The two only
 * differ in tag name and class suffix; collapsing avoids the boilerplate of
 * a `BaseHtmlWidget` base class with two near-identical subclasses.
 */
class HtmlWidget extends WidgetType {
  constructor(
    private readonly html: string,
    private readonly resolver: ImageResolver | undefined,
    private readonly tick: number,
    private readonly kind: 'block' | 'inline',
  ) {
    super();
  }

  eq(other: HtmlWidget) {
    return (
      this.html === other.html &&
      this.resolver === other.resolver &&
      this.tick === other.tick &&
      this.kind === other.kind
    );
  }

  toDOM(view: EditorView) {
    const isBlock = this.kind === 'block';
    const root = document.createElement(isBlock ? 'div' : 'span');
    root.className = `${rawHtmlClassName} ${rawHtmlClassName}-${this.kind}`;
    root.innerHTML = sanitizeHtml(this.html);
    if (this.resolver) resolveMediaSources(root, this.resolver);
    attachLinkInterceptor(root, view);
    return root;
  }

  ignoreEvent() {
    return false;
  }
}


const rawHtmlTheme = EditorView.theme({
  [`& .${rawHtmlClassName}-block`]: {
    padding: '4px 0',
  },
  [`& .${rawHtmlClassName}-block img, & .${rawHtmlClassName}-block video`]: {
    maxWidth: '100%',
  },
  [`& .${rawHtmlClassName}-block figure`]: {
    margin: '0',
    textAlign: 'center',
  },
  [`& .${rawHtmlClassName}-block figcaption`]: {
    fontSize: '0.875em',
    color: 'rgba(127, 127, 127, 0.85)',
    marginTop: '4px',
  },
  // The wrapper itself stays plain `display: inline` so that flow-affecting
  // void elements like `<br>` propagate their line-break to the outer line.
  // (display: inline-block would trap the break inside the wrapper.)
  [`& .${rawHtmlClassName}-inline`]: {
    display: 'inline',
  },
  [`& .${rawHtmlClassName}-inline img`]: {
    maxHeight: 'var(--cm-image-inline-max-height, 320px)',
    maxWidth: '100%',
    verticalAlign: 'middle',
  },
});


interface ParsedTag {
  name: string;
  isClosing: boolean;
  /** XHTML-style self-close: `<br/>`, `<img />`. */
  isXhtmlSelfClose: boolean;
}

/**
 * Parse the text of a lezer `HTMLTag` node into kind + name. Permissive
 * regex — accepts attributes (with quoted values, etc.), unlike the simple
 * `<name>` matcher in `replaceInlineHtml.ts`.
 */
function parseHtmlTag(text: string): ParsedTag | null {
  const trimmed = text.trim();
  const m = trimmed.match(/^<(\/?)\s*([a-zA-Z][a-zA-Z0-9-]*)/);
  if (!m) return null;
  return {
    name: m[2].toLowerCase(),
    isClosing: m[1] === '/',
    isXhtmlSelfClose: m[1] === '' && /\/\s*>$/.test(trimmed),
  };
}

/** Self-closing tag (XHTML form OR an HTML void element written as `<br>`). */
function isSelfClosingVoidTag(tag: ParsedTag): boolean {
  if (tag.isClosing) return false;
  return tag.isXhtmlSelfClose || VOID_ELEMENTS.has(tag.name);
}

// Tags handled by the existing class-based system in
// `inlineRendering/replaceInlineHtml.ts`. We must NOT also intercept them
// here — that would double-render.
const PAIRED_TAGS_HANDLED_ELSEWHERE = new Set(['mark', 'kbd', 'sup', 'sub']);

/**
 * Walk forward through siblings of an opening `HTMLTag` and find its matching
 * closing tag, respecting nested same-name pairs via depth counter.
 */
function findMatchingClose(
  openNode: SyntaxNode,
  tagName: string,
  state: EditorState,
): SyntaxNode | null {
  let depth = 1;
  let cur: SyntaxNode | null = openNode.nextSibling;
  while (cur) {
    if (cur.name === 'HTMLTag') {
      const parsed = parseHtmlTag(state.sliceDoc(cur.from, cur.to));
      if (parsed && parsed.name === tagName) {
        if (parsed.isClosing) {
          depth -= 1;
          if (depth === 0) return cur;
        } else if (!isSelfClosingVoidTag(parsed)) {
          depth += 1;
        }
      }
    }
    cur = cur.nextSibling;
  }
  return null;
}


interface DecorationEntry {
  from: number;
  to: number;
  decoration: Decoration;
}

function buildDecorations(
  state: EditorState,
  resolver: ImageResolver | undefined,
  tick: number,
): DecorationSet {
  const entries: DecorationEntry[] = [];
  const head = state.selection.main.head;
  const tree = ensureSyntaxTree(state, state.doc.length, 500);
  if (!tree) return Decoration.none;

  tree.iterate({
    enter(node) {
      if (node.name === 'HTMLBlock') {
        const lineFrom = state.doc.lineAt(node.from);
        const lineTo = state.doc.lineAt(node.to);
        const blockFrom = lineFrom.from;
        const blockTo = lineTo.to;
        // Cursor anywhere on the block's lines → reveal source
        if (head >= blockFrom && head <= blockTo) return;

        const html = state.sliceDoc(node.from, node.to);
        entries.push({
          from: blockFrom,
          to: blockTo,
          decoration: Decoration.replace({
            widget: new HtmlWidget(html, resolver, tick, 'block'),
            block: true,
          }),
        });
        return;
      }
      if (node.name === 'HTMLTag') {
        const text = state.sliceDoc(node.from, node.to);
        const parsed = parseHtmlTag(text);
        if (!parsed) return;

        if (isSelfClosingVoidTag(parsed)) {
          if (head >= node.from && head <= node.to) return;
          entries.push({
            from: node.from,
            to: node.to,
            decoration: Decoration.replace({
              widget: new HtmlWidget(text, resolver, tick, 'inline'),
            }),
          });
          return;
        }

        if (parsed.isClosing) return;

        // Skip the four tags handled by the existing class-based system in
        // `inlineRendering/replaceInlineHtml.ts` to avoid double rendering.
        if (PAIRED_TAGS_HANDLED_ELSEWHERE.has(parsed.name)) return;

        const closeNode = findMatchingClose(node.node, parsed.name, state);
        if (!closeNode) return;
        if (head >= node.from && head <= closeNode.to) return;

        const fullHtml = state.sliceDoc(node.from, closeNode.to);
        entries.push({
          from: node.from,
          to: closeNode.to,
          decoration: Decoration.replace({
            widget: new HtmlWidget(fullHtml, resolver, tick, 'inline'),
          }),
        });
      }
    },
  });

  entries.sort((a, b) => a.from - b.from);
  const builder = new RangeSetBuilder<Decoration>();
  for (const e of entries) {
    builder.add(e.from, e.to, e.decoration);
  }
  return builder.finish();
}


export function createRawHtmlExtension(options: RawHtmlOptions = {}): Extension {
  const resolver = options.resolver;
  let tick = 0;

  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildDecorations(state, resolver, tick);
    },
    update(deco, tr) {
      const hasRefresh = tr.effects.some((e) => e.is(refreshRawHtmlEffect));
      if (hasRefresh) {
        tick += 1;
        return buildDecorations(tr.state, resolver, tick);
      }
      if (tr.docChanged || tr.selection) {
        return buildDecorations(tr.state, resolver, tick);
      }
      return deco;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  return [rawHtmlTheme, field];
}
