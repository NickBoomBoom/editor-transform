import type { SlateValue } from '../types.ts'

/**
 * The wangEditor module namespace the engine is bound to. Exposed so callers
 * can register custom modules on the *same* instance the engine parses with.
 */
export interface EditorModule {
  createEditor: (option?: Record<string, unknown>) => EditorLike
  Boot?: { registerModule?: (mod: unknown) => void }
  [exportName: string]: unknown
}

export interface EditorLike {
  children: SlateValue
  getHtml: () => string
  getText?: () => string
  [member: string]: unknown
}

export interface Engine {
  /** `internal` when wangEditor's own loader is reachable, else `public`. */
  readonly kind: 'internal' | 'public'
  /** The wangEditor module the engine parses with, for custom registration. */
  readonly module?: EditorModule
  /** Convert an HTML string into `editor.children`. */
  parse(html: string): SlateValue
  /** Convert a Slate document into HTML. */
  serialize(value: SlateValue): string
  /**
   * Drop any pooled editor so the next call rebuilds it.
   *
   * A module's `editorPlugin` only runs while an editor is being constructed,
   * so a module registered after the first parse has no effect until the
   * pooled instance is thrown away. Engines that build an editor per call
   * (the `public` one) do not need this.
   */
  reset?(): void
  /** Release pooled editor state. Idempotent. */
  dispose(): void
}
