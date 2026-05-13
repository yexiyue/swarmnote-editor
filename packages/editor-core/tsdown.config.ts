import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    // Functional built-in plugins
    "src/plugins/math/index.ts",
    "src/plugins/table/index.ts",
    "src/plugins/mermaid/index.ts",
    "src/plugins/admonition/index.ts",
    "src/plugins/codeBlock/index.ts",
    "src/plugins/blockImage/index.ts",
    "src/plugins/rawHtml/index.ts",
    "src/plugins/smartPaste/index.ts",
    // Interaction placeholders (v0.1 占位，runtime 待 v0.2)
    "src/plugins/interactions/slash/index.ts",
    "src/plugins/interactions/wikilink/index.ts",
    "src/plugins/interactions/selectionToolbar/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Mark all runtime deps as external so the bundle stays slim and
  // host repos share their own copies of CodeMirror / yjs.
  // tsdown auto-externalizes anything in `dependencies` / `peerDependencies`,
  // so no explicit list is needed once package.json declares them all.
});
