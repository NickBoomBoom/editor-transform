/**
 * Node.js entry point.
 *
 * `global-jsdom/register` must be the very first import: wangEditor looks up
 * `document` while its module body is evaluated, and ESM evaluates imports in
 * declaration order.
 */
import 'global-jsdom/register'

import { setBuiltinModulesProvider, setEngineFactory, setEngineUnavailableReason } from './api.ts'
import { builtinModules } from './builtin-modules.ts'
import { createInternalEngine, getInternalEngineFailure } from './engine/internal.ts'
import { createPublicEngine } from './engine/public.ts'
import type { Engine } from './engine/types.ts'

// The editor-v3 node types shipped with the package are installed on the first
// conversion, so callers only import the functions they use.
setBuiltinModulesProvider(builtinModules)

setEngineFactory((kind: 'internal' | 'public'): Engine | null => {
  if (kind === 'public') return createPublicEngine()

  const engine = createInternalEngine()
  // Let the FALLBACK_ENGINE warning explain the downgrade instead of leaving
  // production to guess why the leak-free engine went missing.
  setEngineUnavailableReason('internal', engine ? null : getInternalEngineFailure())
  return engine
})

export * from './api.ts'
export * from './dom.ts'
export * from './errors.ts'
export * from './types.ts'
export type * from './engine/types.ts'

/**
 * The repair for editor-v3's lossy `shadow-dom` serializer. Already installed by
 * default; exported for callers that run with {@link disableBuiltinModules}.
 */
export { shadowDomSerializerRepair } from './repairs.ts'

/**
 * Why the leak-free engine is unavailable, or `null` when it is active. The
 * same reason is appended to the `FALLBACK_ENGINE` warning; this is for health
 * checks and startup logs.
 */
export { getInternalEngineFailure } from './engine/internal.ts'
