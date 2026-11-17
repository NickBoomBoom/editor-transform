/**
 * Browser entry point. The DOM is already there, so only the documented
 * wangEditor API is used.
 */
import { setEngineFactory } from './api.ts'
import { createPublicEngine } from './engine/public.ts'
import type { Engine } from './engine/types.ts'

setEngineFactory((): Engine => createPublicEngine())

export * from './api.ts'
export * from './dom.ts'
export * from './errors.ts'
export * from './types.ts'
export type * from './engine/types.ts'

/**
 * The repair for editor-v3's lossy `shadow-dom` serializer. The browser entry
 * point cannot ship the editor-v3 modules themselves (the app already has them),
 * so it is exported here instead of being installed automatically.
 */
export { shadowDomSerializerRepair } from './repairs.ts'
