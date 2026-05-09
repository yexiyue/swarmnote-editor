import { EditorView } from '@codemirror/view';

export const inlineRenderingTheme = EditorView.theme({
  '.cm-checkbox-widget': {
    cursor: 'pointer',
    verticalAlign: 'middle',
    marginRight: '6px',
    width: '15px',
    height: '15px',
    accentColor: 'hsl(40, 72%, 46%)',
  },
  '.cm-bullet-widget': {
    display: 'inline-block',
    width: '1.4em',
    textAlign: 'center',
    color: 'inherit',
    userSelect: 'none',
    fontSize: '0.65em',
    verticalAlign: 'middle',
  },
  '.cm-divider-widget': {
    border: 'none',
    borderTop: '1px solid rgba(127, 127, 127, 0.35)',
    margin: '12px 0',
  },
});
