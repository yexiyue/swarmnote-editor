import {
  DEFAULT_SELECTION_FORMATTING,
  type EditorControl,
  type SelectionFormatting,
} from "@swarmnote/editor-core";
import {
  Bold,
  Code,
  Code2,
  Copy,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  Minus,
  MousePointerSquareDashed,
  Pilcrow,
  PlusSquare,
  Quote,
  Scissors,
  Strikethrough,
  Table as TableIcon,
  Type,
} from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface EditorContextMenuProps {
  /** Wrap the editor container with this element. The right-click is bound here. */
  children: ReactNode;
  /** Editor control for command dispatch. */
  control: EditorControl | null;
  /** Called when "Insert Image" is clicked. Host opens a file picker. */
  onInsertImage: () => void | Promise<void>;
  /**
   * Optional Cmd/Ctrl symbol used in shortcut labels. Defaults to "⌘" on macOS,
   * "Ctrl" otherwise. Pass `""` to suppress shortcut labels entirely.
   */
  modKey?: string;
  /**
   * Optional view-section slot: rendered at the end of the menu (after Clipboard).
   * Consumers inject host-specific items like `<ContextMenuCheckboxItem
   * checked={readableLineLength}>...`. Pass `null` (default) to omit the
   * View section entirely.
   */
  viewSection?: ReactNode;
}

const defaultModKey = (() => {
  if (typeof navigator === "undefined") return "Ctrl";
  return navigator.platform.toLowerCase().includes("mac") ? "⌘" : "Ctrl";
})();

/**
 * Right-click context menu for desktop CodeMirror editors. Modeled after
 * Obsidian: full menu is always rendered; selection-dependent items (Cut,
 * Copy) are disabled when there's no selection. The formatting snapshot for
 * active-state checkmarks is frozen at menu-open time via
 * `getSelectionFormatting()` — items don't re-render while the menu is mounted.
 *
 * Distributed via shadcn registry — consumers run `shadcn add editor-context-menu`
 * and own the source. Labels are English defaults; localize by editing the
 * copy in your host. Host-specific view toggles (readable line width, etc.)
 * go through the `viewSection` prop.
 */
export function EditorContextMenu({
  children,
  control,
  onInsertImage,
  modKey = defaultModKey,
  viewSection,
}: EditorContextMenuProps) {
  const [formatting, setFormatting] = useState<SelectionFormatting>(DEFAULT_SELECTION_FORMATTING);
  const [hasSelection, setHasSelection] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open || !control) return;
      setFormatting(control.getSelectionFormatting());
      setHasSelection(!control.view.state.selection.main.empty);
    },
    [control],
  );

  const exec = useCallback(
    (name: string, ...args: unknown[]) => {
      control?.execCommand(name, ...args);
    },
    [control],
  );

  const copySelection = useCallback(() => {
    if (!control) return;
    const { from, to } = control.view.state.selection.main;
    if (from === to) return;
    const text = control.view.state.sliceDoc(from, to);
    navigator.clipboard.writeText(text).catch((err) => console.warn("clipboard write failed", err));
  }, [control]);

  const cutSelection = useCallback(() => {
    if (!control) return;
    const { from, to } = control.view.state.selection.main;
    if (from === to) return;
    const text = control.view.state.sliceDoc(from, to);
    navigator.clipboard.writeText(text).catch((err) => console.warn("clipboard write failed", err));
    control.view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
    });
    control.view.focus();
  }, [control]);

  const handleHeading = useCallback(
    (newLevel: number) => {
      if (!control) return;
      const current = formatting.heading;
      if (newLevel === current) return;
      if (newLevel === 0) {
        if (current >= 1) control.execCommand("toggleHeading", current);
        return;
      }
      control.execCommand("toggleHeading", newLevel);
    },
    [control, formatting.heading],
  );

  const handleList = useCallback(
    (type: string) => {
      const cmd =
        type === "unordered"
          ? "toggleUnorderedList"
          : type === "ordered"
            ? "toggleOrderedList"
            : type === "check"
              ? "toggleCheckList"
              : null;
      if (cmd) exec(cmd);
    },
    [exec],
  );

  const headingValue = String(formatting.heading);
  const listValue = formatting.listType ?? "";
  const shortcut = (chord: string) => (modKey ? `${modKey}${chord}` : undefined);

  return (
    <ContextMenu onOpenChange={handleOpenChange}>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {control == null ? null : (
        <ContextMenuContent className="w-56">
          <ContextMenuItem onClick={() => exec("insertLink")}>
            <LinkIcon />
            Insert Link
            {shortcut("K") ? <ContextMenuShortcut>{shortcut("K")}</ContextMenuShortcut> : null}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => void onInsertImage()}>
            <ImageIcon />
            Insert Image
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <PlusSquare />
              Insert
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuItem onClick={() => exec("insertCodeBlock")}>
                <Code2 />
                Code block
              </ContextMenuItem>
              <ContextMenuItem onClick={() => exec("insertTable")}>
                <TableIcon />
                Table
              </ContextMenuItem>
              <ContextMenuItem onClick={() => exec("insertHorizontalRule")}>
                <Minus />
                Horizontal rule
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Type />
              Text format
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuCheckboxItem
                checked={formatting.bold}
                onCheckedChange={() => exec("toggleBold")}
              >
                <Bold />
                Bold
                {shortcut("B") ? <ContextMenuShortcut>{shortcut("B")}</ContextMenuShortcut> : null}
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={formatting.italic}
                onCheckedChange={() => exec("toggleItalic")}
              >
                <Italic />
                Italic
                {shortcut("I") ? <ContextMenuShortcut>{shortcut("I")}</ContextMenuShortcut> : null}
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={formatting.strikethrough}
                onCheckedChange={() => exec("toggleStrike")}
              >
                <Strikethrough />
                Strikethrough
                {shortcut("⇧X") ? (
                  <ContextMenuShortcut>{shortcut("⇧X")}</ContextMenuShortcut>
                ) : null}
              </ContextMenuCheckboxItem>
              <ContextMenuCheckboxItem
                checked={formatting.highlight}
                onCheckedChange={() => exec("toggleHighlight")}
              >
                <Highlighter />
                Highlight
                {shortcut("⇧=") ? (
                  <ContextMenuShortcut>{shortcut("⇧=")}</ContextMenuShortcut>
                ) : null}
              </ContextMenuCheckboxItem>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem
                checked={formatting.code}
                onCheckedChange={() => exec("toggleCode")}
              >
                <Code />
                Inline code
                {shortcut("E") ? <ContextMenuShortcut>{shortcut("E")}</ContextMenuShortcut> : null}
              </ContextMenuCheckboxItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Pilcrow />
              Paragraph
            </ContextMenuSubTrigger>
            <ContextMenuSubContent>
              <ContextMenuRadioGroup value={listValue} onValueChange={handleList}>
                <ContextMenuRadioItem value="unordered">Bullet list</ContextMenuRadioItem>
                <ContextMenuRadioItem value="ordered">Numbered list</ContextMenuRadioItem>
                <ContextMenuRadioItem value="check">Task list</ContextMenuRadioItem>
              </ContextMenuRadioGroup>
              <ContextMenuSeparator />
              <ContextMenuRadioGroup
                value={headingValue}
                onValueChange={(v) => handleHeading(Number.parseInt(v, 10))}
              >
                <ContextMenuRadioItem value="1">Heading 1</ContextMenuRadioItem>
                <ContextMenuRadioItem value="2">Heading 2</ContextMenuRadioItem>
                <ContextMenuRadioItem value="3">Heading 3</ContextMenuRadioItem>
                <ContextMenuRadioItem value="4">Heading 4</ContextMenuRadioItem>
                <ContextMenuRadioItem value="5">Heading 5</ContextMenuRadioItem>
                <ContextMenuRadioItem value="6">Heading 6</ContextMenuRadioItem>
                <ContextMenuRadioItem value="0">Body</ContextMenuRadioItem>
              </ContextMenuRadioGroup>
              <ContextMenuSeparator />
              <ContextMenuCheckboxItem
                checked={formatting.inBlockquote}
                onCheckedChange={() => exec("toggleBlockquote")}
              >
                <Quote />
                Blockquote
                {shortcut("⇧Q") ? (
                  <ContextMenuShortcut>{shortcut("⇧Q")}</ContextMenuShortcut>
                ) : null}
              </ContextMenuCheckboxItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          <ContextMenuSeparator />

          <ContextMenuItem onClick={cutSelection} disabled={!hasSelection}>
            <Scissors />
            Cut
            {shortcut("X") ? <ContextMenuShortcut>{shortcut("X")}</ContextMenuShortcut> : null}
          </ContextMenuItem>
          <ContextMenuItem onClick={copySelection} disabled={!hasSelection}>
            <Copy />
            Copy
            {shortcut("C") ? <ContextMenuShortcut>{shortcut("C")}</ContextMenuShortcut> : null}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => exec("selectAll")}>
            <MousePointerSquareDashed />
            Select all
            {shortcut("A") ? <ContextMenuShortcut>{shortcut("A")}</ContextMenuShortcut> : null}
          </ContextMenuItem>

          {viewSection ? (
            <>
              <ContextMenuSeparator />
              {viewSection}
            </>
          ) : null}
        </ContextMenuContent>
      )}
    </ContextMenu>
  );
}
