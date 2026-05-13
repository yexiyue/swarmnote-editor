import { createEditor, type EditorControl, type EditorProps } from '@swarmnote/editor-core';
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type CSSProperties,
} from 'react';

export interface EditorViewProps extends EditorProps {
  /** Additional className on the mount container. */
  className?: string;
  /** Inline style on the mount container. */
  style?: CSSProperties;
}

export interface EditorViewHandle {
  /** The underlying EditorControl, or null before mount / after destroy. */
  control: EditorControl | null;
}

/**
 * React wrapper around `createEditor`. Mounts the CodeMirror editor into a
 * `<div>` on mount and destroys it on unmount.
 *
 * Exposes the `EditorControl` via `ref` — host code can call commands, set
 * search state, etc. via `editorRef.current?.control?.execCommand('toggleBold')`.
 *
 * @example
 * ```tsx
 * const editorRef = useRef<EditorViewHandle>(null);
 * <EditorView
 *   ref={editorRef}
 *   initialText="# Hello"
 *   settings={settings}
 *   plugins={plugins}
 *   host={{ resolveImage, uploadFile }}
 *   onEvent={(e) => console.log(e)}
 * />
 * ```
 */
export const EditorView = forwardRef<EditorViewHandle, EditorViewProps>(function EditorView(
  { className, style, ...editorProps },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<EditorControl | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      get control() {
        return controlRef.current;
      },
    }),
    [],
  );

  // Mount editor once. `editorProps` is intentionally NOT in deps —
  // CM6 doesn't support reactive prop updates after mount; host must remount
  // (via key change) to swap props like plugins / settings / collaboration.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!containerRef.current) return;
    controlRef.current = createEditor(containerRef.current, editorProps);
    return () => {
      controlRef.current?.destroy();
      controlRef.current = null;
    };
  }, []);

  return <div ref={containerRef} className={className} style={style} />;
});
