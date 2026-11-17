/**
 * The custom-node modules the Node entry point installs by default.
 *
 * Callers should only have to import the conversion functions, so the entry
 * point hands this function to `setBuiltinModulesProvider()` and the modules are
 * installed on the first engine build - before any editor is constructed.
 *
 * The set is:
 *
 * 1. the editor-v3 node modules that `pnpm sync:editor-v3` bundles into
 *    `dist/editor-v3-modules.mjs` (shipped inside the published package);
 * 2. {@link shadowDomSerializerRepair}, installed last so it wins over the
 *    bundled `shadow-dom` rule.
 *
 * Loading is `require`-based on purpose. The generated file is the same one
 * callers can import themselves, and `require()` of an ES module returns the
 * *same* instance as `import` does - which is what keeps registration
 * idempotent when a caller registers the modules by hand as well.
 */
import { createRequire } from 'node:module'
import path from 'node:path'

import { reportBuiltinModulesWarning } from './api.ts'
import { shadowDomSerializerRepair } from './repairs.ts'

/**
 * Where the sync script leaves its bundle, relative to this module: next to the
 * built entry (`dist/`) and, for a source checkout running the TypeScript entry
 * directly, in `dist/` one level up.
 */
const CANDIDATES = ['./editor-v3-modules.mjs', '../dist/editor-v3-modules.mjs']

let cached: unknown[] | null | undefined
let reportedMissing = false

function nodeRequire(): NodeRequire {
  // See src/engine/internal.ts:39 - `__filename` is only a reliable base when it
  // is a real path; under `node -e` Node hands ESM modules the bogus "[eval]".
  const base =
    typeof __filename === 'string' && path.isAbsolute(__filename) ? __filename : import.meta.url
  return createRequire(base)
}

/**
 * The bundled editor-v3 node modules, or `null` when the generated file is not
 * reachable (source checkout without `pnpm sync:editor-v3`, or a runtime where
 * `require(esm)` is unavailable - Node < 22.12).
 */
export function loadEditorV3NodeModules(): unknown[] | null {
  if (cached !== undefined) return cached
  cached = null

  const requireFrom = nodeRequire()
  for (const specifier of CANDIDATES) {
    try {
      const loaded = requireFrom(specifier) as { editorV3NodeModules?: unknown }
      if (Array.isArray(loaded?.editorV3NodeModules)) {
        cached = loaded.editorV3NodeModules
        break
      }
    } catch {
      /* Not this candidate - try the next one. */
    }
  }
  return cached
}

/**
 * Everything to install on a fresh engine, plus a warning when the generated
 * file is missing - otherwise the custom nodes would silently collapse into
 * paragraphs, which is exactly the failure this module exists to prevent.
 */
export function builtinModules(): readonly unknown[] {
  const vendor = loadEditorV3NodeModules()
  if (!vendor && !reportedMissing) {
    reportedMissing = true
    reportBuiltinModulesWarning(
      'The editor-v3 custom node modules are unavailable: dist/editor-v3-modules.mjs was not ' +
        'found or could not be required (require(esm) needs Node >= 22.12). Nodes such as audio, ' +
        'answer-box, shadow-dom and textParse* will collapse into paragraphs. In a source ' +
        'checkout run `pnpm sync:editor-v3`, or register the modules yourself with ' +
        'registerModule(editorV3NodeModules) from "editor-transform/editor-v3-modules".',
    )
  }
  return vendor ? [...vendor, shadowDomSerializerRepair] : [shadowDomSerializerRepair]
}
