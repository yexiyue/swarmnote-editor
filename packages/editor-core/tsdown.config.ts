import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    /^@codemirror\//,
    /^@lezer\//,
    "yjs",
    "y-codemirror.next",
    "dompurify",
    "katex",
  ],
});
