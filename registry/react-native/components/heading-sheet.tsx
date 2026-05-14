import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { Pressable, Text, View } from "react-native";

export type HeadingLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface EditorHeadingSheetRef {
  open: () => void;
  close: () => void;
}

interface EditorHeadingSheetProps {
  /** Currently active heading level (0 = body, 1-6 = H1-H6). */
  currentLevel: HeadingLevel;
  /** Called when the user selects a new heading level (or body / 0). */
  onSelect: (level: HeadingLevel) => void;
  /**
   * Optional color tokens. Defaults to neutral. Pass theme-driven colors from
   * your host (e.g., NativeWind / useColorScheme).
   */
  colors?: {
    background?: string;
    foreground?: string;
    activeBg?: string;
    border?: string;
  };
}

const DEFAULT_COLORS = {
  background: "#fff",
  foreground: "#222",
  activeBg: "#eef",
  border: "#e5e5e5",
};

const ITEMS: Array<{ level: HeadingLevel; label: string }> = [
  { level: 0, label: "Body" },
  { level: 1, label: "Heading 1" },
  { level: 2, label: "Heading 2" },
  { level: 3, label: "Heading 3" },
  { level: 4, label: "Heading 4" },
  { level: 5, label: "Heading 5" },
  { level: 6, label: "Heading 6" },
];

/**
 * Bottom-sheet picker for heading levels (Body + H1..H6) in React Native.
 *
 * Distributed via react-native-reusables registry. Uses `@gorhom/bottom-sheet`
 * for the sheet primitive. Customize labels by editing the items array or
 * pass `colors` for theming.
 */
export const EditorHeadingSheet = forwardRef<EditorHeadingSheetRef, EditorHeadingSheetProps>(
  function EditorHeadingSheet({ currentLevel, onSelect, colors }, ref) {
    const c = { ...DEFAULT_COLORS, ...colors };
    const sheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => ["50%"], []);

    useImperativeHandle(ref, () => ({
      open: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }));

    const renderBackdrop = useCallback(
      (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );

    return (
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: c.background }}
      >
        <BottomSheetView style={{ paddingHorizontal: 16, paddingBottom: 24 }}>
          {ITEMS.map((item) => {
            const active = item.level === currentLevel;
            return (
              <Pressable
                key={item.level}
                onPress={() => {
                  onSelect(item.level);
                  sheetRef.current?.close();
                }}
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  marginVertical: 2,
                  borderRadius: 8,
                  backgroundColor: active ? c.activeBg : "transparent",
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Text style={{ fontSize: 16, color: c.foreground }}>{item.label}</Text>
              </Pressable>
            );
          })}
          <View style={{ height: 24 }} />
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
