import type { AdmonitionTypeConfig, AdmonitionTypesMap } from './types';

/**
 * Lucide-icon SVG markup for each admonition type.
 *
 * Stored as raw SVG strings so they can be `innerHTML`-injected into the
 * title widget — `currentColor` lets each icon inherit the type's accent
 * color via CSS. Sourced from lucide.dev (ISC license).
 */
const ICON = {
  note: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`,
  tip: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/></svg>`,
  important: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  warning: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  caution: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>`,
  info: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  success: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  question: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
  failure: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
  danger: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  bug: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3 3 0 1 1 6 0v1"/><path d="M6 13H2"/><path d="M22 13h-4"/></svg>`,
  example: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>`,
  quote: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>`,
};

/**
 * GFM standard admonition types — note / tip / important / warning / caution.
 * Default registration when `admonitionExtension()` is called with no args.
 *
 * `icon` is raw SVG markup (innerHTML-injected). Use `currentColor` so the
 * stroke inherits the type's accent color via CSS.
 */
export const GFM_TYPES: AdmonitionTypesMap = {
  note: { icon: ICON.note, color: '#1e88e5', label: 'Note', className: 'note' },
  tip: { icon: ICON.tip, color: '#43a047', label: 'Tip', className: 'tip' },
  important: { icon: ICON.important, color: '#7b1fa2', label: 'Important', className: 'important' },
  warning: { icon: ICON.warning, color: '#fb8c00', label: 'Warning', className: 'warning' },
  caution: { icon: ICON.caution, color: '#e53935', label: 'Caution', className: 'caution' },
};

/**
 * Obsidian community-extended set — GFM types plus the 8 most common
 * additional callouts. Users migrating from Obsidian opt in via:
 *
 * ```ts
 * admonitionExtension({ types: { ...GFM_TYPES, ...OBSIDIAN_TYPES } })
 * ```
 */
export const OBSIDIAN_TYPES: AdmonitionTypesMap = {
  ...GFM_TYPES,
  info: { icon: ICON.info, color: '#039be5', label: 'Info', className: 'info' },
  success: { icon: ICON.success, color: '#43a047', label: 'Success', className: 'success' },
  question: { icon: ICON.question, color: '#fb8c00', label: 'Question', className: 'question' },
  failure: { icon: ICON.failure, color: '#e53935', label: 'Failure', className: 'failure' },
  danger: { icon: ICON.danger, color: '#e53935', label: 'Danger', className: 'danger' },
  bug: { icon: ICON.bug, color: '#e53935', label: 'Bug', className: 'bug' },
  example: { icon: ICON.example, color: '#7e57c2', label: 'Example', className: 'example' },
  quote: { icon: ICON.quote, color: '#757575', label: 'Quote', className: 'quote' },
};

/**
 * Fallback configuration used for unrecognized type strings — preserves
 * admonition styling but uses a neutral pin icon and the literal type name
 * as label so cross-vault notes don't fail to render.
 */
export const DEFAULT_ADMONITION_TYPE: AdmonitionTypeConfig = {
  icon: ICON.pin,
  color: '#757575',
  label: '',
  className: 'default',
};
