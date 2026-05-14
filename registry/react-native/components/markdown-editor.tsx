import { useEditorBridge, useEditorFormatting } from "@swarmnote/editor-react-native";
import type {
  AwarenessUserState,
  EditorEvent,
  EditorInitOptions,
} from "@swarmnote/editor-react-native/contracts";
import { Asset } from "expo-asset";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme, View } from "react-native";
import type { WebViewMessageEvent } from "react-native-webview";
import WebView from "react-native-webview";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const EDITOR_HTML_MODULE = require("@swarmnote/editor-react-native/webview");

interface MarkdownEditorProps {
  /** Initial text-mode content. Used when collab mode is not enabled. */
  initialText?: string;
  /** Doc UUID for collaboration mode; pair with `initialState`. */
  docUuid?: string;
  /** Y.Doc v1 update bytes seeding the collab editor. */
  initialState?: Uint8Array;
  /** Local Y.Doc updates the editor produces. Host forwards to backend. */
  onCollabUpdate?: (update: Uint8Array) => void;
  /** Local Awareness updates. Host forwards to broadcast. */
  onAwarenessUpdate?: (update: Uint8Array) => void;
  /** Remote presence snapshot. */
  onPresenceChange?: (users: AwarenessUserState[]) => void;
  /** Non-collab editor events. */
  onEditorEvent?: (event: EditorEvent) => void;
  /** Workspace root path (used by the WebView runtime for asset:// resolution). */
  workspacePath?: string;
  /** Optional `initOptions` override merged with defaults. */
  initOptions?: Partial<EditorInitOptions>;
}

/**
 * React Native markdown editor wrapper. Mounts a WebView running the bundled
 * editor HTML (from `@swarmnote/editor-react-native/webview`) and bridges
 * editor commands / events via Comlink. Business logic (file picker, image
 * upload, bridge registries, sync) lives in your host — this component is
 * the WebView shell.
 *
 * Distributed via react-native-reusables registry — consumers run the RNR CLI
 * to add this and own the source. Spike scaffold; production version may
 * also wrap `EditorToolbar` + `HeadingSheet` + trio sheets, or leave them
 * separate so host composes freely.
 *
 * **Required peer deps in host**:
 * - `react-native-webview`
 * - `expo-asset` (or RN equivalent for HTML module loading)
 * - `@swarmnote/editor-react-native` (provides `useEditorBridge` + WebView HTML bundle)
 */
export function MarkdownEditor({
  initialText = "",
  docUuid,
  initialState,
  onCollabUpdate,
  onAwarenessUpdate,
  onPresenceChange,
  onEditorEvent,
  workspacePath,
  initOptions,
}: MarkdownEditorProps) {
  const webviewRef = useRef<WebView | null>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [editorCreated, setEditorCreated] = useState(false);

  const collabMode = docUuid !== undefined && initialState !== undefined;
  const colorScheme = useColorScheme();
  const appearance = colorScheme === "dark" ? "dark" : "light";

  // Asset loading: WebView ships as a single-file HTML bundle inside
  // `@swarmnote/editor-react-native/webview`.
  useEffect(() => {
    let cancelled = false;
    const asset = Asset.fromModule(EDITOR_HTML_MODULE);
    asset.localUri = null;
    (asset as unknown as { downloaded: boolean }).downloaded = false;
    asset
      .downloadAsync()
      .then(() => {
        if (!cancelled && asset.localUri) setHtmlUri(asset.localUri);
      })
      .catch((err) => {
        console.error("[Editor] HTML asset download failed:", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Editor formatting state (for toolbar etc. — host may consume this).
  const { handleEditorEvent } = useEditorFormatting(onEditorEvent);

  const handleCollab = useCallback((u: Uint8Array) => onCollabUpdate?.(u), [onCollabUpdate]);
  const handleAware = useCallback((u: Uint8Array) => onAwarenessUpdate?.(u), [onAwarenessUpdate]);
  const handlePresence = useCallback(
    (users: AwarenessUserState[]) => onPresenceChange?.(users),
    [onPresenceChange],
  );

  // Comlink bridge: WebView runtime ↔ RN main thread.
  const { editorApi, setWebViewRef, onWebViewMessage } = useEditorBridge({
    onRuntimeReady() {
      setRuntimeReady(true);
    },
    onEditorEvent: handleEditorEvent,
    onCollaborationUpdate: handleCollab,
    onAwarenessUpdate: handleAware,
    onPresenceChange: handlePresence,
  });

  const handleRef = useCallback(
    (ref: WebView | null) => {
      if (!ref) {
        setRuntimeReady(false);
        setEditorCreated(false);
      }
      webviewRef.current = ref;
      setWebViewRef(ref ? { injectJavaScript: (js: string) => ref.injectJavaScript(js) } : null);
    },
    [setWebViewRef],
  );

  // createEditor invocation after runtime ready.
  useEffect(() => {
    if (!runtimeReady || !editorApi) return;
    if (editorCreated) return;
    const options: EditorInitOptions = {
      initialText,
      collaboration: collabMode
        ? { docUuid: docUuid as string, initialState: initialState as Uint8Array }
        : undefined,
      appearance,
      workspacePath,
      ...initOptions,
    };
    void editorApi.createEditor(options).then(() => setEditorCreated(true));
  }, [
    runtimeReady,
    editorApi,
    editorCreated,
    initialText,
    collabMode,
    docUuid,
    initialState,
    appearance,
    workspacePath,
    initOptions,
  ]);

  const handleMessage = useCallback(
    (e: WebViewMessageEvent) => onWebViewMessage(e),
    [onWebViewMessage],
  );

  if (!htmlUri) return <View style={{ flex: 1 }} />;

  return (
    <View style={{ flex: 1 }}>
      <WebView
        ref={handleRef}
        source={{ uri: htmlUri }}
        originWhitelist={["file://*", "https://*", "data:*"]}
        onMessage={handleMessage}
        style={{ flex: 1, opacity: 0.99 }}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        scrollEnabled
        nestedScrollEnabled
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        overScrollMode="never"
        setSupportMultipleWindows={false}
      />
    </View>
  );
}
