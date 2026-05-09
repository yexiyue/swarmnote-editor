import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  // Mark all runtime deps as external so the bundle stays slim and
  // host repos share their own copies of CodeMirror / yjs.
  // tsdown auto-externalizes anything in `dependencies` / `peerDependencies`,
  // so no explicit list is needed once package.json declares them all.
});
