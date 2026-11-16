import { defineConfig } from 'tsup'

const shared = {
  // Declarations come from `tsc` (see tsconfig.build.json): TypeScript 7 has no
  // JS compiler API, which is what tsup's dts pipeline needs.
  dts: false,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outDir: 'dist',
} as const

export default defineConfig([
  // Node / backend entry. jsdom + the wangEditor bundle are loaded at runtime,
  // never inlined, so the published package stays small and version-matched.
  {
    ...shared,
    entry: { node: 'src/node.ts' },
    format: ['esm', 'cjs'],
    platform: 'node',
    target: 'node20',
    external: ['@wangeditor-next/editor', 'jsdom', 'global-jsdom'],
  },
  // Browser entry, used by the test page and by any in-page consumer.
  // ESM only: it is meant to be loaded through an import map or a bundler.
  {
    ...shared,
    clean: false,
    entry: { browser: 'src/browser.ts' },
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    external: ['@wangeditor-next/editor'],
  },
])
