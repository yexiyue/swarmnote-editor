import { Facet } from '@codemirror/state';

/**
 * Master switch for live-preview behavior. When false, all extensions that
 * conditionally hide markdown source SHALL render source unconditionally.
 *
 * Extensions consume this via `shouldShowSource`, which short-circuits to
 * `false` when the facet resolves to false.
 */
export const collapseOnSelectionFacet = Facet.define<boolean, boolean>({
  combine: (values) => (values.length > 0 ? values[values.length - 1] : true),
});
