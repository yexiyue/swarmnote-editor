import type { EditorState } from '@codemirror/state';
import type { Decoration, WidgetType } from '@codemirror/view';
import type { SyntaxNodeRef } from '@lezer/common';

export type RevealStrategy = 'line' | 'select' | 'active';

export interface ReplacementExtension {
  createDecoration(
    node: SyntaxNodeRef,
    state: EditorState,
    parentTags: ReadonlyMap<string, number>,
  ): Decoration | WidgetType | null;

  getDecorationRange?(
    node: SyntaxNodeRef,
    state: EditorState,
  ): [number] | [number, number] | null;

  /** Default: true — hide decoration when selection intersects */
  hideWhenContainsSelection?: boolean;

  /** Default: 'line' */
  getRevealStrategy?(
    node: SyntaxNodeRef,
    state: EditorState,
  ): RevealStrategy | boolean;

  /**
   * Override the [from, to] range used when evaluating reveal strategy.
   * Default: same as decoration range.
   *
   * Use this to expand reveal judgement to a parent node (e.g. EmphasisMark
   * conceal should reveal whenever the cursor is anywhere within the
   * StrongEmphasis parent, not just on the `**` characters themselves).
   */
  getRevealRange?(
    node: SyntaxNodeRef,
    state: EditorState,
  ): [number, number] | null;
}

export interface InlineRenderingSpec {
  nodeNames: string[];
  extension: ReplacementExtension;
}
