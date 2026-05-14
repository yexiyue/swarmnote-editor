import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/contracts.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // tsdown auto-externalizes peerDependencies; react / react-native / comlink
  // stay shared with the host. WebView-only deps (yjs / katex / mermaid / ...)
  // are inlined by vite-plugin-singlefile and never reach this tsdown bundle.
});
