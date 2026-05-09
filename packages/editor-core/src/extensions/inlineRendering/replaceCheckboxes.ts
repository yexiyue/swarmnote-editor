import type { InlineRenderingSpec } from './types';
import { CheckboxWidget } from './widgets/CheckboxWidget';

export const replaceCheckboxes: InlineRenderingSpec = {
  nodeNames: ['TaskMarker'],
  extension: {
    createDecoration(node, state) {
      const text = state.sliceDoc(node.from, node.to);
      const checked = /\[[xX]\]/.test(text);
      return new CheckboxWidget(checked, node.from);
    },
    getRevealStrategy() {
      return 'active';
    },
    // Share reveal range with replaceBulletLists so the dash and checkbox
    // reveal together: cursor anywhere in `- [ ]` prefix → both reveal,
    // cursor in the body text → both stay concealed (widgets visible).
    getRevealRange(node, state) {
      const line = state.doc.lineAt(node.from);
      const taskMatch = line.text.match(/^(\s*[-*]\s\[[ xX]\])/);
      if (taskMatch) {
        return [line.from, line.from + taskMatch[0].length];
      }
      return null;
    },
  },
};
