import type { EditorApi, SelectionFormatting } from "@swarmnote/editor-react-native/contracts";
import type * as Comlink from "comlink";
import {
  Bold,
  Code,
  Heading,
  Image as ImageIcon,
  Italic,
  Link,
  List,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Redo,
  Strikethrough,
  Undo,
} from "lucide-react-native";
import { useCallback } from "react";
import { Pressable, ScrollView, View } from "react-native";

const ICON_SIZE = 22;
const BUTTON_WIDTH = 44;
const TOOLBAR_HEIGHT = 48;

interface EditorToolbarProps {
  /** Comlink-wrapped editor API from `useEditorBridge`. */
  editorApi: Comlink.Remote<EditorApi>;
  /** Current formatting state from `useEditorFormatting`. */
  formatting: SelectionFormatting;
  /** Called when the user taps the insert-image button. Host opens a file picker. */
  onRequestInsertImage: () => void;
  /** Called when the user taps the heading button. Host opens a sheet to pick H1..H6. */
  onRequestHeading: () => void;
  /**
   * Optional color tokens. Defaults to a neutral palette. Pass theme-driven
   * colors from your host's theme hook (e.g., NativeWind / useColorScheme).
   */
  colors?: {
    background?: string;
    border?: string;
    foreground?: string;
    activeBg?: string;
    activeFg?: string;
  };
}

const DEFAULT_COLORS = {
  background: "#fff",
  border: "#e5e5e5",
  foreground: "#222",
  activeBg: "#eef",
  activeFg: "#111",
};

interface ButtonSpec {
  id: string;
  icon: LucideIcon;
  accessibilityLabel: string;
  active?: boolean;
  onPress: () => void;
}

/**
 * Horizontal toolbar for the React Native WebView editor. Floats above the
 * keyboard; commands are dispatched via Comlink to the WebView runtime
 * inside `@swarmnote/editor-react-native/webview`.
 *
 * Distributed via react-native-reusables registry — consumers run the RNR CLI
 * to add this and own the source. Customize colors via the `colors` prop or
 * by editing the file directly (typical shadcn workflow).
 *
 * Spike scaffold — production version may want to integrate
 * `react-native-keyboard-controller` for animated keyboard avoidance.
 */
export function EditorToolbar({
  editorApi,
  formatting,
  onRequestInsertImage,
  onRequestHeading,
  colors,
}: EditorToolbarProps) {
  const c = { ...DEFAULT_COLORS, ...colors };
  const exec = useCallback(
    (cmd: string, ...args: unknown[]) => {
      void editorApi.execCommand(cmd, ...args);
    },
    [editorApi],
  );

  const buttons: ButtonSpec[] = [
    {
      id: "undo",
      icon: Undo,
      accessibilityLabel: "Undo",
      onPress: () => exec("undo"),
    },
    {
      id: "redo",
      icon: Redo,
      accessibilityLabel: "Redo",
      onPress: () => exec("redo"),
    },
    {
      id: "heading",
      icon: Heading,
      accessibilityLabel: "Heading",
      active: formatting.heading > 0,
      onPress: onRequestHeading,
    },
    {
      id: "bold",
      icon: Bold,
      accessibilityLabel: "Bold",
      active: formatting.bold,
      onPress: () => exec("toggleBold"),
    },
    {
      id: "italic",
      icon: Italic,
      accessibilityLabel: "Italic",
      active: formatting.italic,
      onPress: () => exec("toggleItalic"),
    },
    {
      id: "strike",
      icon: Strikethrough,
      accessibilityLabel: "Strikethrough",
      active: formatting.strikethrough,
      onPress: () => exec("toggleStrike"),
    },
    {
      id: "code",
      icon: Code,
      accessibilityLabel: "Code",
      active: formatting.code,
      onPress: () => exec("toggleCode"),
    },
    {
      id: "link",
      icon: Link,
      accessibilityLabel: "Insert link",
      onPress: () => exec("insertLink"),
    },
    {
      id: "image",
      icon: ImageIcon,
      accessibilityLabel: "Insert image",
      onPress: onRequestInsertImage,
    },
    {
      id: "ul",
      icon: List,
      accessibilityLabel: "Bullet list",
      active: formatting.listType === "unordered",
      onPress: () => exec("toggleUnorderedList"),
    },
    {
      id: "ol",
      icon: ListOrdered,
      accessibilityLabel: "Numbered list",
      active: formatting.listType === "ordered",
      onPress: () => exec("toggleOrderedList"),
    },
    {
      id: "check",
      icon: ListTodo,
      accessibilityLabel: "Task list",
      active: formatting.listType === "check",
      onPress: () => exec("toggleCheckList"),
    },
    {
      id: "indent-less",
      icon: ListIndentDecrease,
      accessibilityLabel: "Decrease indent",
      onPress: () => exec("indentLess"),
    },
    {
      id: "indent-more",
      icon: ListIndentIncrease,
      accessibilityLabel: "Increase indent",
      onPress: () => exec("indentMore"),
    },
  ];

  return (
    <View
      style={{
        height: TOOLBAR_HEIGHT,
        backgroundColor: c.background,
        borderTopWidth: 1,
        borderTopColor: c.border,
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 8, alignItems: "center" }}
      >
        {buttons.map((b) => {
          const Icon = b.icon;
          return (
            <Pressable
              key={b.id}
              accessibilityRole="button"
              accessibilityLabel={b.accessibilityLabel}
              accessibilityState={{ selected: b.active }}
              onPress={b.onPress}
              style={{
                width: BUTTON_WIDTH,
                height: TOOLBAR_HEIGHT - 8,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 6,
                backgroundColor: b.active ? c.activeBg : "transparent",
              }}
            >
              <Icon size={ICON_SIZE} color={b.active ? c.activeFg : c.foreground} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
