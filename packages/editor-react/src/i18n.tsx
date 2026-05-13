import { createContext, type ReactNode, useContext } from 'react';

/**
 * Translator signature.
 *
 * - `key`: dot-namespaced i18n key (e.g. `'editor.toolbar.bold'`)
 * - `defaultText`: fallback English string when host has no translation
 */
export type TFunction = (key: string, defaultText: string) => string;

const defaultT: TFunction = (_key, defaultText) => defaultText;

const I18nContext = createContext<TFunction>(defaultT);

/**
 * Wrap your tree to inject translations into editor-react components.
 * The host decides how to map keys (Lingui, i18next, plain function, etc.).
 *
 * @example
 * ```tsx
 * import { I18nProvider } from '@swarmnote/editor-react';
 * import { i18n } from '@lingui/core';
 *
 * <I18nProvider value={(key, def) => i18n._(key) || def}>
 *   <EditorView ... />
 * </I18nProvider>
 * ```
 */
export function I18nProvider({
  value,
  children,
}: {
  value: TFunction;
  children: ReactNode;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Get the active translator. Falls back to identity-on-default
 * (returns the `defaultText` arg) when no provider wraps the tree.
 */
export function useT(): TFunction {
  return useContext(I18nContext);
}
