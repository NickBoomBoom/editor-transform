import { analyze } from './analyze.ts'
import { normalizeHtml } from './dom.ts'
import { ContentLossError, TransformInputError } from './errors.ts'
import type { EditorModule, Engine } from './engine/types.ts'
import {
  isSlateElement,
  isSlateText,
  type EngineMode,
  type SlateElement,
  type SlateValue,
  type TransformOptions,
  type Transformer,
  type TransformWarning,
  type WarningCode,
} from './types.ts'

/** Which engine to build for a given mode. Returns `null` when unavailable. */
export type EngineFactory = (kind: 'internal' | 'public') => Engine | null

let factory: EngineFactory | null = null
const engines = new Map<'internal' | 'public', Engine>()
let fallbackWarned = false
let defaults: TransformOptions = {}

/** Warning sink for the duration of one public call. */
let sink: ((warning: TransformWarning) => void) | null = null

/** Why an engine could not be built, reported by the entry point. */
const engineFailure = new Map<'internal' | 'public', string>()

/**
 * Record why an engine was unavailable, so a silent downgrade to the public
 * API in production comes with a reason. Called by the Node entry point.
 */
export function setEngineUnavailableReason(
  kind: 'internal' | 'public',
  reason: string | null,
): void {
  if (reason) engineFailure.set(kind, reason)
  else engineFailure.delete(kind)
}

function emit(code: WarningCode, message: string, detail?: unknown): void {
  const warning: TransformWarning = { code, message }
  if (detail !== undefined) warning.detail = detail
  if (sink) sink(warning)
  else console.warn(`[editor-transform] ${message}`)
}

function getEngine(kind: 'internal' | 'public'): Engine | null {
  const existing = engines.get(kind)
  if (existing) return existing
  if (!factory) return null

  // Built-in modules have to be in `pendingModules` before the engine exists:
  // `Boot.registerModule` installs a module's `editorPlugin` while an editor is
  // being constructed, so a rule registered afterwards never applies.
  resolveBuiltinModules()

  const engine = factory(kind)
  if (!engine) return null

  // Engines are built lazily, so a module registered before the first call has
  // to be installed here - there is no editor yet for it to be missing from.
  for (const mod of pendingModules) registerOn(engine, mod)
  engines.set(kind, engine)
  return engine
}

/**
 * Modules the caller registered, replayed onto every engine built afterwards.
 *
 * The `internal` and `public` engines are two *separate evaluations* of the
 * wangEditor bundle, so a module has to be installed on both; and an engine
 * built after the registration would otherwise start blind.
 */
const pendingModules: unknown[] = []

/**
 * Modules already installed per wangEditor module instance.
 *
 * Registration is not idempotent (`Boot.registerModule` pushes menus and
 * render-elems into arrays), so replaying must not install the same module
 * twice on the same instance - which is what would happen each time an engine
 * is rebuilt after {@link disposeEngines}.
 */
const installed = new WeakMap<object, Set<unknown>>()

/** Install `mod` on `engine` once. Returns true when something was installed. */
function registerOn(engine: Engine, mod: unknown): boolean {
  const api = engine.module
  if (!api) return false
  const register = api.Boot?.registerModule
  if (typeof register !== 'function') return false

  let seen = installed.get(api)
  if (!seen) {
    seen = new Set()
    installed.set(api, seen)
  }
  if (seen.has(mod)) return false
  seen.add(mod)
  register(mod)
  return true
}

/** Install `mod` on the engines that already exist. Returns true if any took it. */
function installOnExisting(mod: unknown): boolean {
  let installedAnywhere = false
  for (const existing of engines.values()) {
    if (registerOn(existing, mod)) installedAnywhere = true
  }

  // Only a pooled editor that already exists can be stale.
  if (installedAnywhere) {
    for (const existing of engines.values()) existing.reset?.()
  }
  return installedAnywhere
}

/** Produces the module set installed on every engine, without being asked to. */
export type BuiltinModulesProvider = () => readonly unknown[]

let builtinProvider: BuiltinModulesProvider | null = null
let builtinsEnabled = true
let builtinsResolved = false

/**
 * Register the provider of the built-in modules. Called by the entry points,
 * which are the only place that knows how to find the bundled editor-v3 modules;
 * pass `null` to opt out entirely (an embedding host with its own module set).
 */
export function setBuiltinModulesProvider(provider: BuiltinModulesProvider | null): void {
  builtinProvider = provider
  builtinsResolved = false
}

/**
 * Report a problem with the built-in module set. Exposed for the entry points,
 * which are the only place that can tell *why* the modules are missing.
 */
export function reportBuiltinModulesWarning(message: string): void {
  emit('BUILTIN_MODULES_UNAVAILABLE', message)
}

/**
 * Queue the built-in modules for the first engine build.
 *
 * Deliberately lazy: doing it at import time would load wangEditor (and, for the
 * `internal` engine, patch the bundle) before the caller converts anything, and
 * the rules are only needed once an engine exists.
 *
 * Entries are *re-appended* rather than skipped when already queued, so the
 * provider's order always holds: the `shadow-dom` repair must be registered
 * after the bundled rule it overrides, even if the caller installed one of these
 * objects by hand before the first conversion.
 */
function resolveBuiltinModules(): void {
  if (builtinsResolved) return
  builtinsResolved = true
  if (!builtinsEnabled || !builtinProvider) return

  for (const mod of builtinProvider()) {
    const queued = pendingModules.indexOf(mod)
    if (queued >= 0) pendingModules.splice(queued, 1)
    pendingModules.push(mod)
  }
}

/**
 * Stop installing the built-in modules, for callers that want the bare
 * wangEditor behaviour. Must be called before the first conversion: wangEditor's
 * registry can only be added to, so modules that are already installed stay
 * installed (drop the pooled editor with {@link disposeEngines} to start over).
 */
export function disableBuiltinModules(): void {
  builtinsEnabled = false
  builtinsResolved = true
}

/**
 * Install the built-in modules and return the set that was installed. Useful for
 * a health check that wants to show the difference they make, since
 * {@link disableBuiltinModules} has to be called before the first conversion.
 */
export function enableBuiltinModules(): readonly unknown[] {
  builtinsEnabled = true
  builtinsResolved = true

  const modules = builtinProvider ? [...builtinProvider()] : []
  for (const mod of modules) {
    if (!pendingModules.includes(mod)) pendingModules.push(mod)
    installOnExisting(mod)
  }
  return modules
}

function resolveEngine(mode: EngineMode): Engine {
  if (mode === 'internal' || mode === 'auto') {
    const internal = getEngine('internal')
    if (internal) return internal
    if (mode === 'internal') {
      throw new Error(
        'The "internal" engine is unavailable: wangEditor\'s bundle could not be patched ' +
          '(unsupported version or bundle layout). Use engine: "public" instead.',
      )
    }
  }

  const publicEngine = getEngine('public')
  if (!publicEngine) {
    throw new Error('No engine is registered. Import "editor-transform" (Node) or "editor-transform/browser".')
  }

  if (mode === 'auto' && !fallbackWarned) {
    fallbackWarned = true
    const reason = engineFailure.get('internal')
    emit(
      'FALLBACK_ENGINE',
      'Falling back to the public wangEditor API. This engine leaks roughly 28 KB per parsed ' +
        'document on @wangeditor-next/editor@6.6.2 and is not suitable for long-running servers.' +
        (reason ? ` Reason: ${reason}.` : ''),
    )
  }
  return publicEngine
}

function withSink<T>(options: TransformOptions, run: () => T): T {
  const previous = sink
  sink = options.onWarning ?? null
  try {
    return run()
  } finally {
    sink = previous
  }
}

function assertElement(node: SlateElement, path: string): void {
  if (node.children.length === 0) {
    throw new TransformInputError(path, 'a Slate element with at least one child', 'an element with children: []')
  }
  node.children.forEach((child, index) => {
    const childPath = `${path}.children[${index}]`
    if (isSlateText(child)) return
    if (isSlateElement(child)) {
      assertElement(child, childPath)
      return
    }
    throw new TransformInputError(childPath, 'a Slate text or element node', child)
  })
}

function assertSlateValue(value: unknown): asserts value is SlateValue {
  if (!Array.isArray(value)) {
    throw new TransformInputError('value', 'an array of Slate nodes (editor.children)', value)
  }
  value.forEach((node, index) => {
    // Slate - and therefore wangEditor - requires the document root to hold
    // block elements; a bare text node here renders to nonsense.
    if (!isSlateElement(node)) {
      throw new TransformInputError(
        `value[${index}]`,
        'a Slate element node with a children array',
        node,
      )
    }
    assertElement(node, `value[${index}]`)
  })
}

/**
 * Register the engine factory. Called by the entry points; also usable to plug
 * in a custom engine (for example a shared worker or a remote parser).
 */
export function setEngineFactory(next: EngineFactory): void {
  disposeEngines()
  factory = next
  fallbackWarned = false
}

/** Dispose every pooled engine. The next call rebuilds them lazily. */
export function disposeEngines(): void {
  for (const engine of engines.values()) {
    try {
      engine.dispose()
    } catch {
      /* a failing dispose must never mask the caller's work */
    }
  }
  engines.clear()
}

/** Merge defaults applied to every call. */
export function configure(options: TransformOptions): void {
  defaults = { ...defaults, ...options }
}

export function getConfig(): Readonly<TransformOptions> {
  return { ...defaults }
}

export function resetConfig(): void {
  defaults = {}
}

/**
 * Which engine a mode resolves to. `internal` is the leak-free fast path;
 * `public` is the documented wangEditor API. Useful for health checks.
 */
export function getEngineKind(mode: EngineMode = 'auto'): 'internal' | 'public' {
  return resolveEngine(mode).kind
}

/**
 * The wangEditor module the active engine parses with.
 *
 * With the `internal` engine this is a patched copy of the bundle, so custom
 * modules must be registered through {@link registerModule} rather than through
 * a direct `import { Boot } from '@wangeditor-next/editor'`.
 */
export function getEditorApi(mode: EngineMode = 'auto'): EditorModule | undefined {
  return resolveEngine(mode).module
}

/**
 * Register a custom wangEditor module on every instance the engine may use.
 *
 * The modules the package ships (the editor-v3 node types and the `shadow-dom`
 * serializer repair) are installed automatically, so this is for *additional*
 * rules. It is still the only supported way to install them: the `internal`
 * engine parses with a patched *copy* of the bundle, so a module registered
 * through a direct `import { Boot } from '@wangeditor-next/editor'` lands on a
 * different instance and is silently ignored. For the same reason the module is
 * installed on both the `internal` and the `public` instance - they are two
 * separate evaluations of the bundle.
 *
 * A module's `editorPlugin` runs only while an editor is being constructed, so
 * any pooled editor is dropped and rebuilt on the next call. Register before
 * the first `htmlToSlate`/`slateToHtml` and no rebuild is needed.
 *
 * Registering the same module object twice is a no-op.
 */
export function registerModule(mod: unknown, mode: EngineMode = 'auto'): void {
  const engine = resolveEngine(mode)
  if (typeof engine.module?.Boot?.registerModule !== 'function') {
    throw new Error('The active wangEditor instance does not expose Boot.registerModule')
  }

  if (!pendingModules.includes(mod)) pendingModules.push(mod)
  installOnExisting(mod)
}

/**
 * Parse HTML produced by `editor.getHtml()` into Slate JSON.
 *
 * Unknown elements are dropped together with their text by wangEditor, so the
 * result is always checked against the input and reported through
 * `onWarning` (or thrown when `strict` is set).
 */
export function htmlToSlate(html: string, options?: TransformOptions): SlateValue {
  const resolved: TransformOptions = { ...defaults, ...options }
  return withSink(resolved, () => {
    if (typeof html !== 'string') {
      throw new TransformInputError('html', 'a string', html)
    }

    const source = (resolved.normalizeHtml ?? true) ? normalizeHtml(html) : html
    const engine = resolveEngine(resolved.engine ?? 'auto')
    const value = engine.parse(source)

    // Render once so the loss report can be measured against what a backend can
    // actually regenerate. Slate text nodes are not the right yardstick: a
    // custom node type may keep its text in its own fields (editor-v3's
    // `shadow-dom` keeps it in `doms[].html`), which is not a loss.
    const rendered = value.length === 0 ? '' : engine.serialize(value)

    // Compare against the original input: normalisation only removes
    // whitespace, which the analysis ignores anyway.
    const { report, unknownTags } = analyze(html, rendered, resolved.allowedTags)

    if (unknownTags.length > 0) {
      emit(
        'UNKNOWN_TAG',
        `Unrecognised tag(s) <${unknownTags.join('>, <')}>: no rule reproduced them, so their ` +
          'content was dropped unless a custom module handles them',
        unknownTags,
      )
    }
    if (report.droppedText) {
      emit('CONTENT_LOSS', `Content was dropped while parsing: ${JSON.stringify(report.droppedText)}`, report)
    }
    if (resolved.strict && (report.droppedText || unknownTags.length > 0)) {
      throw new ContentLossError(report.droppedText, unknownTags)
    }
    if (value.length === 0) {
      emit('EMPTY_RESULT', 'Parsing produced an empty Slate document')
    }
    return value
  })
}

/** Render Slate JSON back to HTML, using the same rules as `getHtml()`. */
export function slateToHtml(value: SlateValue, options?: TransformOptions): string {
  const resolved: TransformOptions = { ...defaults, ...options }
  return withSink(resolved, () => {
    assertSlateValue(value)
    if (value.length === 0) {
      emit('EMPTY_RESULT', 'The Slate document is empty; returning an empty string')
      return ''
    }
    return resolveEngine(resolved.engine ?? 'auto').serialize(value)
  })
}

/** A transformer bound to fixed options, for callers that pass options once. */
export function createTransformer(options: TransformOptions = {}): Transformer {
  return {
    htmlToSlate: (html, callOptions) => htmlToSlate(html, { ...options, ...callOptions }),
    slateToHtml: (value, callOptions) => slateToHtml(value, { ...options, ...callOptions }),
    dispose: disposeEngines,
  }
}
