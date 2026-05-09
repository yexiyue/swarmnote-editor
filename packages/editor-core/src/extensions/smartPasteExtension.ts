/**
 * Smart paste / drop integrations.
 *
 * Two pieces:
 * - `pasteLinkPlugin`: when the user pastes a URL while a non-empty selection
 *   is active, replace the paste with `[selection](url)` markdown link form.
 * - `dropFileHandler`: route file drops through an optional `uploadFile`
 *   callback, inserting `![alt](url)` at the drop position. When no callback
 *   is provided, the drop is preventDefault'd and silently ignored.
 *
 * The plugin keys exclusively on `tr.isUserEvent("input.paste")` so
 * programmatic dispatches with URL-shaped content are never transformed.
 */
import type { Extension } from '@codemirror/state';
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view';

const URL_REGEX = /^https?:\/\/[-a-zA-Z0-9@:%._+~#=]{1,256}([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/;

export interface UploadFileResult {
  url: string;
  alt?: string;
}

export type UploadFileHandler = (file: File) => Promise<UploadFileResult>;

export interface SmartPasteOptions {
  uploadFile?: UploadFileHandler;
}

const pasteLinkPlugin = ViewPlugin.fromClass(
  class {
    update(update: ViewUpdate): void {
      for (const tr of update.transactions) {
        if (!tr.isUserEvent('input.paste')) continue;

        const selection = update.startState.selection.main;
        if (selection.empty) continue;

        const pastedParts: string[] = [];
        let from = 0;
        let to = 0;
        tr.changes.iterChanges((fromA, _toA, _fromB, toB, inserted) => {
          pastedParts.push(inserted.sliceString(0));
          from = fromA;
          to = toB;
        });

        const pasted = pastedParts.join('').trim();
        if (!URL_REGEX.test(pasted)) continue;

        const selectedText = update.startState.sliceDoc(selection.from, selection.to);

        // Defer one tick so the original paste transaction completes before we
        // dispatch the replacement.
        setTimeout(() => {
          update.view.dispatch({
            changes: { from, to, insert: `[${selectedText}](${pasted})` },
          });
        }, 0);
      }
    }
  },
);

function buildDropHandler(uploadFile: UploadFileHandler | undefined) {
  return EditorView.domEventHandlers({
    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return false;

      event.preventDefault();
      if (!uploadFile) return true;

      const dropPos =
        view.posAtCoords({ x: event.clientX, y: event.clientY }) ??
        view.state.selection.main.head;

      // Process files sequentially so multi-drop produces a stable order.
      void (async () => {
        let insertPos = dropPos;
        for (const file of Array.from(files)) {
          try {
            const { url, alt } = await uploadFile(file);
            const insertion = `![${alt ?? ''}](${url})`;
            view.dispatch({
              changes: { from: insertPos, insert: insertion },
            });
            insertPos += insertion.length;
          } catch {
            // Swallow individual file failures; continue with remaining files.
          }
        }
      })();

      return true;
    },
  });
}

export function createSmartPasteExtension(options: SmartPasteOptions = {}): Extension {
  return [pasteLinkPlugin, buildDropHandler(options.uploadFile)];
}
