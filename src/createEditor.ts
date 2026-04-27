import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { EditorState, type Extension } from '@codemirror/state';
import { history, historyKeymap, indentWithTab, standardKeymap } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { GFM } from '@lezer/markdown';
import { languages as codeLanguages } from '@codemirror/language-data';
import { syntaxHighlighting } from '@codemirror/language';
import { searchKeymap } from '@codemirror/search';
import { EditorView, drawSelection, dropCursor, highlightActiveLine, keymap } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';

import { collapseOnSelectionFacet, mouseSelectingExtension } from './core';
import { EditorControlImpl } from './EditorControl';
import { EditorEventType } from './events';
import {
  computeSelectionFormatting,
  cycleHeading,
  insertLink,
  toggleBold,
  toggleCode,
  toggleItalic,
  toggleList,
  toggleStrike,
} from './editorCommands';
import {
  createCollaborationExtension,
  createEditorSettingsExtension,
  createInlineRenderingExtension,
  createMarkdownDecorationExtension,
  createSearchExtension,
  markdownHighlightExtension,
} from './extensions';
import { createBlockCodeExtension } from './extensions/renderBlockCode';
import { createBlockImageExtension } from './extensions/renderBlockImages';
import { createBlockTableExtension } from './extensions/renderBlockTables';
import { createCtrlClickLinksExtension } from './extensions/links/ctrlClickLinksExtension';
import { createLinkTooltipExtension } from './extensions/links/linkTooltipExtension';
import { createSmartPasteExtension } from './extensions/smartPasteExtension';
import { createAdmonitionExtension } from './extensions/admonition';
import { insertNewlineContinueMarkup } from './editorCommands/insertNewlineContinueMarkup';
import { markdownMathExtension } from './extensions/markdownMathExtension';
import { markdownFrontMatterExtension } from './extensions/markdownFrontMatterExtension';
import { createLineAwareClipboardExtension } from './extensions/lineAwareClipboardExtension';
import type { EditorControl, EditorProps } from './types';
import { createSelectionRange } from './utils/selection';

(EditorView as unknown as { EDIT_CONTEXT: boolean }).EDIT_CONTEXT = false;

/** Wrap a void-returning command into a keymap `run` handler that reports "handled". */
function handled(fn: (view: EditorView) => void) {
  return (view: EditorView) => {
    fn(view);
    return true;
  };
}

/** Markdown formatting shortcuts exposed as a CM6 keymap. */
function buildFormatKeymap() {
  return [
    { key: 'Mod-b', run: handled(toggleBold) },
    { key: 'Mod-i', run: handled(toggleItalic) },
    { key: 'Mod-e', run: handled(toggleCode) },
    { key: 'Mod-Shift-x', run: handled(toggleStrike) },
    { key: 'Mod-k', run: handled((view) => insertLink(view)) },
    { key: 'Mod-Shift-7', run: handled((view) => toggleList(view, 'ordered')) },
    { key: 'Mod-Shift-8', run: handled((view) => toggleList(view, 'unordered')) },
    { key: 'Mod-Shift-9', run: handled((view) => toggleList(view, 'check')) },
    { key: 'Mod-Shift-h', run: handled(cycleHeading) },
  ];
}

export function createEditor(
  parent: HTMLElement,
  props: EditorProps,
): EditorControl {
  const {
    initialText,
    initialSelection,
    settings,
    initialSearchState,
    collaboration,
    onEvent,
    imageResolver,
    uploadFile,
  } = props;

  const settingsRuntime = createEditorSettingsExtension(settings);
  const markdownExtensions = [
    ...GFM,
    ...(settings.features.markdownHighlight ? [markdownHighlightExtension] : []),
    ...(settings.features.mathRendering ? [markdownMathExtension] : []),
    markdownFrontMatterExtension,
  ];

  const extensions: Extension[] = [
    collapseOnSelectionFacet.of(true),
    mouseSelectingExtension,
    history(),
    drawSelection(),
    dropCursor(),
    highlightActiveLine(),
    closeBrackets(),
    markdown({
      base: markdownLanguage,
      extensions: markdownExtensions,
      codeLanguages,
    }),
    syntaxHighlighting(classHighlighter),
    settingsRuntime.extension,
    ...(settings.features.markdownDecorations
      ? [createMarkdownDecorationExtension()]
      : []),
    ...(settings.features.inlineRendering
      ? [createInlineRenderingExtension({
          mathRendering: settings.features.mathRendering,
        })]
      : []),
    ...(settings.features.blockImageRendering
      ? [createBlockImageExtension({ resolver: imageResolver }), createBlockTableExtension()]
      : []),
    ...(settings.features.codeBlockMode !== 'off'
      ? [createBlockCodeExtension({ mode: settings.features.codeBlockMode })]
      : []),
    ...(settings.features.admonition ? [createAdmonitionExtension()] : []),
    ...(onEvent
      ? [
          createCtrlClickLinksExtension((url) => {
            onEvent({ kind: EditorEventType.LinkOpen, url });
          }),
        ]
      : []),
    createLinkTooltipExtension(),
    createLineAwareClipboardExtension(),
    ...(settings.features.smartPaste ? [createSmartPasteExtension({ uploadFile })] : []),
    ...(settings.features.collaboration
      ? createCollaborationExtension(collaboration)
      : []),
    ...(settings.features.search
      ? [
          createSearchExtension({
            onSearchStateChange(search, source) {
              onEvent?.({
                kind: EditorEventType.SearchStateChange,
                search,
                source,
              });
            },
          }),
        ]
      : []),
    keymap.of([
      ...closeBracketsKeymap,
      { key: 'Enter', run: insertNewlineContinueMarkup },
      indentWithTab,
      // Format shortcuts — placed before standardKeymap so our Mod-b / Mod-i
      // take precedence over any default single-selection boundary bindings.
      ...buildFormatKeymap(),
      ...standardKeymap,
      ...historyKeymap,
      ...(settings.features.search ? searchKeymap : []),
    ]),
  ];

  if (onEvent) {
    extensions.push(
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onEvent({
            kind: EditorEventType.Change,
          });
        }

        if (update.selectionSet) {
          const selection = update.state.selection.main;
          onEvent({
            kind: EditorEventType.SelectionChange,
            selection: createSelectionRange(selection.anchor, selection.head),
          });
          onEvent({
            kind: EditorEventType.SelectionFormattingChange,
            formatting: computeSelectionFormatting(update.state),
          });
        }

        if (update.focusChanged) {
          onEvent({
            kind: update.view.hasFocus ? EditorEventType.Focus : EditorEventType.Blur,
          });
        }
      }),
    );
  }

  const selection = initialSelection
    ? {
        anchor: initialSelection.anchor,
        head: initialSelection.head,
      }
    : undefined;

  // When collaboration is enabled, seed CM6's initial doc with the current Y.Text
  // content. y-codemirror.next's ySync extension only bridges observer events,
  // so any content that was already in the Y.Text at mount time would otherwise
  // be invisible in CM6 (doc='' would desync from a non-empty ytext).
  let initialDoc = initialText;
  if (collaboration) {
    const ydoc = collaboration.ydoc as { getText: (name: string) => { toString(): string } };
    initialDoc = ydoc.getText(collaboration.fragmentName ?? 'document').toString();
  }

  const view = new EditorView({
    state: EditorState.create({
      doc: initialDoc,
      selection,
      extensions,
    }),
    parent,
  });

  const control = new EditorControlImpl(view, {
    settingsRuntime,
    onDestroy: onEvent
      ? () => {
          onEvent({ kind: EditorEventType.Remove });
        }
      : undefined,
  });

  if (initialSearchState && settings.features.search) {
    control.setSearchState(initialSearchState, 'initialSearchState');
  }

  if (settings.autofocus || props.autofocus) {
    view.focus();
  }

  return control;
}

