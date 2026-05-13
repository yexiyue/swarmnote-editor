import {
  EditorCommandType,
  type EditorControl,
  type SelectionFormatting,
} from '@swarmnote/editor-core';
import { Bold, Code, Heading, Italic, List, ListOrdered, Quote, Strikethrough } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from './i18n';

export interface EditorToolbarProps {
  /** Active editor control. Null disables all buttons (still rendered). */
  control: EditorControl | null;
  /**
   * Current selection formatting state. Host obtains this by subscribing to
   * `EditorEventType.SelectionFormattingChange` events on the editor.
   */
  formatting: SelectionFormatting | null;
  /** Optional className appended to the toolbar container. */
  className?: string;
}

interface ToolButtonProps {
  active?: boolean;
  disabled?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}

function ToolButton({ active, disabled, title, onClick, children }: ToolButtonProps) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={[
        'inline-flex h-8 w-8 items-center justify-center rounded-md',
        'text-foreground transition-colors',
        'hover:bg-accent hover:text-accent-foreground',
        'disabled:cursor-not-allowed disabled:opacity-50',
        active ? 'bg-accent text-accent-foreground' : '',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

/**
 * Minimal built-in toolbar for desktop. Renders Bold / Italic / Strikethrough /
 * Code / Quote / Heading / List buttons that dispatch the corresponding
 * `EditorCommandType.*` via `control.execCommand`.
 *
 * Host is responsible for subscribing to `SelectionFormattingChange` events and
 * passing the current `formatting` so buttons reflect active state.
 *
 * This is a "built-in example" component. Host may use it directly, wrap it,
 * or replace with its own toolbar.
 */
export function EditorToolbar({ control, formatting, className }: EditorToolbarProps) {
  const t = useT();
  const disabled = !control;
  const f = formatting;
  const exec = (cmd: EditorCommandType) => control?.execCommand(cmd);

  return (
    <div
      role="toolbar"
      aria-label={t('editor.toolbar.label', 'Formatting toolbar')}
      className={[
        'flex items-center gap-1 rounded-md border bg-background p-1',
        className ?? '',
      ].join(' ')}
    >
      <ToolButton
        title={t('editor.toolbar.bold', 'Bold')}
        active={f?.bold}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleBold)}
      >
        <Bold size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.italic', 'Italic')}
        active={f?.italic}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleItalic)}
      >
        <Italic size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.strike', 'Strikethrough')}
        active={f?.strikethrough}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleStrike)}
      >
        <Strikethrough size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.code', 'Code')}
        active={f?.code}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleCode)}
      >
        <Code size={16} />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton
        title={t('editor.toolbar.heading', 'Cycle heading')}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.CycleHeading)}
      >
        <Heading size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.quote', 'Blockquote')}
        active={f?.inBlockquote}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleBlockquote)}
      >
        <Quote size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.unorderedList', 'Bullet list')}
        active={f?.listType === 'unordered'}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleUnorderedList)}
      >
        <List size={16} />
      </ToolButton>
      <ToolButton
        title={t('editor.toolbar.orderedList', 'Numbered list')}
        active={f?.listType === 'ordered'}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleOrderedList)}
      >
        <ListOrdered size={16} />
      </ToolButton>
    </div>
  );
}
