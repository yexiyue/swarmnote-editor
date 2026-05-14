import {
  EditorCommandType,
  type EditorControl,
  type SelectionFormatting,
} from "@swarmnote/editor-core";
import { Bold, Code, Heading, Italic, List, ListOrdered, Quote, Strikethrough } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  /** Active editor control. Null disables all buttons (still rendered). */
  control: EditorControl | null;
  /**
   * Current selection formatting state. Host obtains this by subscribing to
   * `EditorEventType.SelectionFormattingChange` events on the editor.
   */
  formatting: SelectionFormatting | null;
  /** Optional className appended to the toolbar container. */
  className?: string;
  /**
   * Optional label overrides. Defaults are English. Customize for i18n.
   */
  labels?: Partial<Record<string, string>>;
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
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md",
        "text-foreground transition-colors",
        "hover:bg-accent hover:text-accent-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active ? "bg-accent text-accent-foreground" : "",
      )}
    >
      {children}
    </button>
  );
}

const DEFAULT_LABELS = {
  bold: "Bold",
  italic: "Italic",
  strike: "Strikethrough",
  code: "Code",
  heading: "Cycle heading",
  quote: "Blockquote",
  unorderedList: "Bullet list",
  orderedList: "Numbered list",
} as const;

/**
 * Minimal built-in toolbar for desktop editors. Renders Bold / Italic /
 * Strikethrough / Code / Quote / Heading / List buttons that dispatch the
 * corresponding `EditorCommandType.*` via `control.execCommand`.
 *
 * Distributed via shadcn registry — consumers run `shadcn add editor-toolbar`
 * and own the source. Migrated out of `@swarmnote/editor-react` v0.4 (was a
 * built-in there in v0.2/v0.3; moved here for host customization).
 *
 * Host is responsible for subscribing to `SelectionFormattingChange` events
 * and passing the current `formatting` so buttons reflect active state.
 */
export function EditorToolbar({ control, formatting, className, labels }: EditorToolbarProps) {
  const disabled = !control;
  const f = formatting;
  const exec = (cmd: EditorCommandType) => control?.execCommand(cmd);
  const L = { ...DEFAULT_LABELS, ...labels };

  return (
    <div
      role="toolbar"
      aria-label="Formatting toolbar"
      className={cn(
        "flex items-center gap-1 rounded-md border bg-background p-1",
        className,
      )}
    >
      <ToolButton
        title={L.bold}
        active={f?.bold}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleBold)}
      >
        <Bold size={16} />
      </ToolButton>
      <ToolButton
        title={L.italic}
        active={f?.italic}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleItalic)}
      >
        <Italic size={16} />
      </ToolButton>
      <ToolButton
        title={L.strike}
        active={f?.strikethrough}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleStrike)}
      >
        <Strikethrough size={16} />
      </ToolButton>
      <ToolButton
        title={L.code}
        active={f?.code}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleCode)}
      >
        <Code size={16} />
      </ToolButton>
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton
        title={L.heading}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.CycleHeading)}
      >
        <Heading size={16} />
      </ToolButton>
      <ToolButton
        title={L.quote}
        active={f?.inBlockquote}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleBlockquote)}
      >
        <Quote size={16} />
      </ToolButton>
      <ToolButton
        title={L.unorderedList}
        active={f?.listType === "unordered"}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleUnorderedList)}
      >
        <List size={16} />
      </ToolButton>
      <ToolButton
        title={L.orderedList}
        active={f?.listType === "ordered"}
        disabled={disabled}
        onClick={() => exec(EditorCommandType.ToggleOrderedList)}
      >
        <ListOrdered size={16} />
      </ToolButton>
    </div>
  );
}
