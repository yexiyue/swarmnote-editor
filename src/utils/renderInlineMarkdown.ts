/**
 * Lightweight inline markdown renderer for table cells.
 *
 * Supports: **bold**, __bold__, *italic*, _italic_, ~~strike~~, `code`,
 * [text](url). All HTML is escaped before pattern replacement so user input
 * cannot inject tags. URLs are filtered to a safe scheme allowlist.
 *
 * Wikilinks `[[note]]` are intentionally NOT supported in v0.2 — that lands in
 * v0.3 via a lezer-markdown node extension (see project_editor_wikilink_v03).
 */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
}

const SAFE_URL_RE = /^(https?:\/\/|mailto:|\/|#|[^:]+$)/i;

function isSafeUrl(url: string): boolean {
  return SAFE_URL_RE.test(url.trim());
}

// Use Unicode Private Use Area chars as placeholders so they cannot collide
// with anything in user-escaped HTML.
const CODE_OPEN = '\u{E000}';
const CODE_CLOSE = '\u{E001}';

function applyEmphasis(html: string, mark: '*' | '_'): string {
  const escaped = mark === '*' ? '\\*' : '_';
  const re = new RegExp(`(${escaped}+)([^${escaped}\\s][^${escaped}]*?)\\1`, 'g');
  return html.replace(re, (match, marks: string, content: string) => {
    if (marks.length === 1) return `<em>${content}</em>`;
    if (marks.length === 2) return `<strong>${content}</strong>`;
    if (marks.length === 3) return `<strong><em>${content}</em></strong>`;
    return match;
  });
}

export function renderInlineMarkdown(raw: string): string {
  let html = escapeHtml(raw);

  // Protect inline code spans before other transforms — `code` content must
  // not be re-parsed for emphasis or link syntax.
  const codeSpans: string[] = [];
  html = html.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codeSpans.push(code);
    return `${CODE_OPEN}${codeSpans.length - 1}${CODE_CLOSE}`;
  });

  // Links — url comes from escaped html so `&` already became `&amp;`.
  html = html.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (match, text: string, url: string) => {
    if (!isSafeUrl(url)) return match;
    return `<a href="${url}">${text}</a>`;
  });

  html = applyEmphasis(html, '*');
  html = applyEmphasis(html, '_');

  html = html.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');

  // Restore inline code last.
  const restoreRe = new RegExp(`${CODE_OPEN}(\\d+)${CODE_CLOSE}`, 'gu');
  html = html.replace(restoreRe, (_, idx: string) => `<code>${codeSpans[Number(idx)]}</code>`);

  return html;
}
