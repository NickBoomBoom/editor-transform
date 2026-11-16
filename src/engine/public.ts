import { Boot, createEditor } from '@wangeditor-next/editor'

import { TransformRuntimeError } from '../errors.ts'
import type { SlateValue } from '../types.ts'
import type { EditorLike, EditorModule, Engine } from './types.ts'

/**
 * The module namespace, created once per process.
 *
 * Engine construction happens before custom modules are replayed onto it, so a
 * fresh object per engine would make the SDK's "already installed on this
 * instance" bookkeeping useless and re-register every module on every rebuild -
 * wangEditor appends menus and render-elems to arrays, so that duplicates them.
 *
 * `Boot` is exposed explicitly: it is what `registerModule` writes through, and
 * without it a custom node type could not be installed on this instance.
 */
const moduleNamespace = { createEditor, Boot } as unknown as EditorModule

/**
 * Engine built purely on wangEditor's documented API.
 *
 * Serialising is pooled and therefore leak-free, but parsing has to build a
 * throwaway editor per document - `createEditor({ html })` retains ~28 KB each
 * time on 6.6.2 and there is no supported way to release it. Prefer the
 * `internal` engine; this one exists for the browser and as a fallback.
 */
export function createPublicEngine(): Engine {
  // Built on first use rather than here: a module's `editorPlugin` only runs
  // while an editor is being constructed, and the engine is constructed before
  // the caller's modules are replayed onto it.
  let pooled: EditorLike | null = null
  const instance = (): EditorLike => (pooled ??= createEditor({ html: '' }) as unknown as EditorLike)

  return {
    kind: 'public',
    module: moduleNamespace,
    parse(html: string): SlateValue {
      try {
        const editor = createEditor({ html }) as unknown as EditorLike
        return structuredClone(editor.children)
      } catch (error) {
        throw new TransformRuntimeError('wangEditor failed to parse the HTML', error)
      }
    },
    serialize(value: SlateValue): string {
      try {
        const ed = instance()
        ed.children = structuredClone(value)
        return ed.getHtml()
      } catch (error) {
        throw new TransformRuntimeError('wangEditor failed to render the Slate document', error)
      }
    },
    reset(): void {
      // Dropped, not destroyed: `destroy()` throws on a headless editor.
      pooled = null
    },
    dispose(): void {
      // Nothing to release beyond dropping the reference.
      pooled = null
    },
  }
}
