/**
 * Error thrown for malformed input.
 *
 * wangEditor's own failures are useless to a backend: passing a non-string to
 * `createEditor({ html })` throws `t.indexOf is not a function`, and an array
 * throws `t.split is not a function`. The SDK validates up front so callers get
 * an actionable message instead.
 */
export class TransformInputError extends TypeError {
  readonly parameter: string
  readonly received: string

  constructor(parameter: string, expected: string, received: unknown) {
    const actual = describe(received)
    super(`${parameter} must be ${expected}, received ${actual}`)
    this.name = 'TransformInputError'
    this.parameter = parameter
    this.received = actual
  }
}

/** Error thrown when wangEditor itself fails to parse or serialise. */
export class TransformRuntimeError extends Error {
  override readonly cause: unknown

  constructor(message: string, cause: unknown) {
    super(message)
    this.name = 'TransformRuntimeError'
    this.cause = cause
  }
}

/** Error thrown when content was silently dropped and `strict` is enabled. */
export class ContentLossError extends Error {
  readonly droppedText: string
  readonly unknownTags: string[]

  constructor(droppedText: string, unknownTags: string[]) {
    const parts: string[] = []
    if (droppedText) parts.push(`dropped text ${JSON.stringify(droppedText)}`)
    if (unknownTags.length > 0) parts.push(`unsupported tags <${unknownTags.join('>, <')}>`)
    super(`Content was lost while parsing HTML: ${parts.join('; ')}`)
    this.name = 'ContentLossError'
    this.droppedText = droppedText
    this.unknownTags = unknownTags
  }
}

/** Human-readable type description used in {@link TransformInputError}. */
export function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return `an array (length ${value.length})`
  if (value === undefined) return 'undefined'
  return `${typeof value} (${String(value).slice(0, 40)})`
}
