import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // tsdown auto-externalizes peerDependencies; react / react-native / comlink
  // stay shared with host
});
