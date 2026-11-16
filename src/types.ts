/**
 * Minimal structural types for the Slate document that wangEditor-next uses
 * internally. They are intentionally permissive: wangEditor adds node types
 * (`header1`, `list-item`, `table`, `image`, ...) and marks (`bold`, `color`,
 * `fontSize`, ...) through plugins, so the SDK must never narrow them.
 */

/** A Slate text node. wangEditor emits `{ text: '' }` plus any active marks. */
export interface SlateText {
  text: string
  [mark: string]: unknown
}

/** A Slate element node (paragraph, header1, list-item, table, ...). */
export interface SlateElement {
  type: string
  children: SlateNode[]
  [prop: string]: unknown
}

export type SlateNode = SlateElement | SlateText

/** The Slate document: `editor.children`. */
export type SlateValue = SlateNode[]

/** True for a Slate text node, false for an element node. */
export function isSlateText(node: unknown): node is SlateText {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { text?: unknown }).text === 'string' &&
    !Array.isArray((node as { children?: unknown }).children)
  )
}

/** True for a Slate element node. */
export function isSlateElement(node: unknown): node is SlateElement {
  return (
    typeof node === 'object' &&
    node !== null &&
    Array.isArray((node as { children?: unknown }).children)
  )
}

/**
 * Which engine performs the conversion.
 *
 * - `internal` reaches wangEditor's own HTML→Slate loader and reuses a single
 *   editor instance. This is the only mode that does not leak (see README).
 * - `public` builds a throwaway editor per document through the documented
 *   `createEditor({ html })` API. Correct, but leaks ~28 KB per call on
 *   `@wangeditor-next/editor@6.6.2`.
 * - `auto` prefers `internal` and falls back to `public` with a warning.
 */
export type EngineMode = 'auto' | 'internal' | 'public'

/** Warning codes reported through {@link TransformWarning}. */
export type WarningCode =
  | 'FALLBACK_ENGINE'
  | 'CONTENT_LOSS'
  | 'UNKNOWN_TAG'
  | 'EMPTY_RESULT'

export interface TransformWarning {
  code: WarningCode
  message: string
  detail?: unknown
}

export interface ContentLossReport {
  /** Visible text extracted from the input HTML. */
  inputText: string
  /**
   * Visible text of the HTML the parsed document renders back to - i.e. what a
   * backend can actually recover. Not the same as the Slate text nodes: custom
   * node types may keep their text in their own fields (editor-v3's
   * `shadow-dom` holds it in `doms[].html`), which is legitimate, not a loss.
   */
  outputText: string
  /**
   * Characters that were present in the input but are missing from the output.
   * wangEditor silently drops unknown elements *together with their text*
   * (e.g. `<mark>`, `<ins>`, `<del>`), so this is the signal that matters.
   */
  droppedText: string
}

export interface TransformOptions {
  /** Engine selection. Defaults to `auto`. */
  engine?: EngineMode
  /**
   * Collapse whitespace-only text nodes that sit between block siblings before
   * parsing. Pretty-printed HTML otherwise turns into extra empty paragraphs.
   * Defaults to `true`.
   */
  normalizeHtml?: boolean
  /**
   * Tag names to trust in addition to the built-in list - the elements a custom
   * module emits, such as `answer-box` or `cp-audio-player`.
   *
   * Only affects `UNKNOWN_TAG` reporting. Content loss is measured against the
   * rendered output, so a tag that survives round-trip is never reported even
   * without this option; setting it just avoids having to explain that.
   */
  allowedTags?: readonly string[]
  /** Called for every warning. Defaults to `console.warn`. */
  onWarning?: (warning: TransformWarning) => void
  /** Throw instead of warning when content is lost or tags are unknown. */
  strict?: boolean
}

/** Options accepted by {@link TransformOptions} plus a shared warning sink. */
export interface TransformerOptions extends TransformOptions {}

export interface Transformer {
  htmlToSlate(html: string, options?: TransformOptions): SlateValue
  slateToHtml(value: SlateValue, options?: TransformOptions): string
  /** Release the pooled editor. The transformer stays usable afterwards. */
  dispose(): void
}
