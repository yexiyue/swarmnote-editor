import { Decoration } from '@codemirror/view';
import type { InlineRenderingSpec } from './types';
import { BulletWidget } from './widgets/BulletWidget';

const hiddenDecoration = Decoration.replace({});

const TASK_LINE_PATTERN = /^\s*[-*]\s\[[ xX]\]/;

export const replaceBulletLists: InlineRenderingSpec = {
  nodeNames: ['ListMark'],
  extension: {
    createDecoration(node, state, parentTags) {
      const bulletListDepth = parentTags.get('BulletList') ?? 0;
      if (bulletListDepth === 0) return null;

      // For task lists, hide the dash entirely (only the checkbox is shown).
      // Without this the line renders as "- ☐ item" with the dash visible
      // before the checkbox — Obsidian-style is just "☐ item".
      const lineText = state.doc.lineAt(node.from).text;
      if (TASK_LINE_PATTERN.test(lineText)) {
        return hiddenDecoration;
      }

      return new BulletWidget(bulletListDepth - 1);
    },
    getDecorationRange(node, state) {
      const lineText = state.doc.lineAt(node.from).text;
      if (TASK_LINE_PATTERN.test(lineText)) {
        // Extend conceal to include the trailing space so the line starts
        // directly with the checkbox.
        const afterMark = state.sliceDoc(node.to, node.to + 1);
        if (afterMark === ' ') {
          return [node.from, node.to + 1];
        }
      }
      return null;
    },
    getRevealStrategy() {
      // Prefix-only reveal: bullet widget stays visible when cursor is in
      // the item's body text. Cursor entering the leading `- ` (or `- [ ]`)
      // prefix triggers reveal.
      return 'active';
    },
    getRevealRange(node, state) {
      const line = state.doc.lineAt(node.from);
      // Task list prefix `- [ ]` (5+ chars including any indent)
      const taskMatch = line.text.match(/^(\s*[-*]\s\[[ xX]\])/);
      if (taskMatch) {
        return [line.from, line.from + taskMatch[0].length];
      }
      // Plain bullet prefix `- ` (or `* `)
      const bulletMatch = line.text.match(/^(\s*[-*]\s)/);
      if (bulletMatch) {
        return [line.from, line.from + bulletMatch[0].length];
      }
      return null;
    },
  },
};
