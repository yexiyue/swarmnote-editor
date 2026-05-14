import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// ESM context — emulate __dirname for path resolution.
const __dirname = dirname(fileURLToPath(import.meta.url));

// The WebView bundle is a sub-build of @swarmnote/editor-react-native.
// vite root is `webview/` (this dir); output goes to ../dist/webview/index.html
// so that npm consumers load it via `@swarmnote/editor-react-native/webview`.
export default defineConfig({
  root: __dirname,
  plugins: [viteSingleFile()],
  build: {
    outDir: resolve(__dirname, "../dist/webview"),
    emptyOutDir: true,
    target: "es2020",
  },
});
