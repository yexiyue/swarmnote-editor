/**
 * Configuration for a single admonition / callout type.
 *
 * `className` is appended to `.cm-admonition-` for CSS targeting; presets use
 * lowercase names matching the GFM / Obsidian convention.
 */
export interface AdmonitionTypeConfig {
  /** Display icon — emoji or short text used in CSS `::before`. */
  icon: string;
  /** Accent color (border / icon tint). Any valid CSS color. */
  color: string;
  /** Human-readable label rendered in the title row. */
  label: string;
  /** CSS class suffix; final class is `cm-admonition-<className>`. */
  className: string;
}

export type AdmonitionTypesMap = Record<string, AdmonitionTypeConfig>;
