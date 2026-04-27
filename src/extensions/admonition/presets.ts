import type { AdmonitionTypeConfig, AdmonitionTypesMap } from './types';

/**
 * GFM standard admonition types — note / tip / important / warning / caution.
 * Default registration when `admonitionExtension()` is called with no args.
 */
export const GFM_TYPES: AdmonitionTypesMap = {
  note: { icon: '📝', color: '#1e88e5', label: 'Note', className: 'note' },
  tip: { icon: '💡', color: '#43a047', label: 'Tip', className: 'tip' },
  important: { icon: '❗', color: '#7b1fa2', label: 'Important', className: 'important' },
  warning: { icon: '⚠️', color: '#fb8c00', label: 'Warning', className: 'warning' },
  caution: { icon: '🚨', color: '#e53935', label: 'Caution', className: 'caution' },
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
  info: { icon: 'ℹ️', color: '#039be5', label: 'Info', className: 'info' },
  success: { icon: '✅', color: '#43a047', label: 'Success', className: 'success' },
  question: { icon: '❓', color: '#fb8c00', label: 'Question', className: 'question' },
  failure: { icon: '❌', color: '#e53935', label: 'Failure', className: 'failure' },
  danger: { icon: '⚡', color: '#e53935', label: 'Danger', className: 'danger' },
  bug: { icon: '🐛', color: '#e53935', label: 'Bug', className: 'bug' },
  example: { icon: '📋', color: '#7e57c2', label: 'Example', className: 'example' },
  quote: { icon: '💬', color: '#757575', label: 'Quote', className: 'quote' },
};

/**
 * Fallback configuration used for unrecognized type strings — preserves
 * admonition styling but uses neutral icon and the literal type name as
 * label so cross-vault notes don't fail to render.
 */
export const DEFAULT_ADMONITION_TYPE: AdmonitionTypeConfig = {
  icon: '📌',
  color: '#757575',
  label: '',
  className: 'default',
};
