/**
 * Node.js entry point.
 *
 * `global-jsdom/register` must be the very first import: wangEditor looks up
 * `document` while its module body is evaluated, and ESM evaluates imports in
 * declaration order.
 */
import 'global-jsdom/register'

import { setEngineFactory, setEngineUnavailableReason } from './api.ts'
import { createInternalEngine, getInternalEngineFailure } from './engine/internal.ts'
import { createPublicEngine } from './engine/public.ts'
import type { Engine } from './engine/types.ts'

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
 * Why the leak-free engine is unavailable, or `null` when it is active. The
 * same reason is appended to the `FALLBACK_ENGINE` warning; this is for health
 * checks and startup logs.
 */
export { getInternalEngineFailure } from './engine/internal.ts'
