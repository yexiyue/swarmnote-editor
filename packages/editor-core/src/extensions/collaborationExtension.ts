import type { Extension } from '@codemirror/state';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import type { EditorCollaborationConfig } from '../types';

/**
 * Wires Y.Text + optional Awareness into CodeMirror via y-codemirror.next.
 *
 * When `collaboration.awareness` is supplied, y-codemirror.next will render
 * remote carets and name tags using the `user` field of each remote awareness
 * state (`{ user: { name, color, ... } }`). Caller is responsible for the
 * Awareness instance's lifecycle and network propagation.
 */
export function createCollaborationExtension(
  collaboration?: EditorCollaborationConfig,
): Extension[] {
  if (!collaboration) {
    return [];
  }

  const ydoc = collaboration.ydoc as Y.Doc;
  const ytext = ydoc.getText(collaboration.fragmentName ?? 'document');

  // y-codemirror.next accepts Awareness | null. We type as unknown in our
  // public config to avoid pulling y-protocols into editor's dependency tree.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const awareness = (collaboration.awareness ?? null) as any;

  return [yCollab(ytext, awareness)];
}
