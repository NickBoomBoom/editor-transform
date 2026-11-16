import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { TransformRuntimeError } from '../errors.ts'
import type { SlateValue } from '../types.ts'
import type { EditorLike, EditorModule, Engine } from './types.ts'

/**
 * Locate wangEditor's HTML→Slate loader inside the installed bundle.
 *
 * `createEditor({ html })` builds a whole editor and leaks it (see README), so
 * parsing through it is not viable on a server. The bundle does expose the two
 * functions that matter - the parser and the content loader that
 * `createEditor` itself calls - but they are module-internal and minified, so
 * they are found by their *shape* rather than by name. Verified against 6.5.0 and
 * 6.6.2; a mismatch is not fatal, it just disables this fast path and falls back
 * to the public API.
 *
 * Note the `[\w$]` name class: minifiers emit `$` in leading position (6.5.0's
 * loader is `$c`), which a plain `\w+` silently rejects.
 */
const PARSE_FN_RE = /function\s+([\w$]+)\s*\(\s*e\s*,\s*t\s*=\s*``\s*\)\s*\{\s*let\s+n\s*=\s*\[\s*\]\s*,\s*\{\s*sanitizeHtml\s*:\s*r\s*\}\s*=\s*e\.getConfig\(\)/
const LOAD_FN_RE = /function\s+([\w$]+)\s*\(\s*e\s*,\s*t\s*\)\s*\{\s*let\s*\{\s*html\s*:\s*n\s*,\s*content\s*:\s*r\s*\}\s*=\s*t\s*,\s*i\s*;/

const PACKAGE_NAME = '@wangeditor-next/editor'
const CACHE_DIR = path.join(os.tmpdir(), 'editor-transform')

interface PatchedModule extends EditorModule {
  __parseHtml: (editor: unknown, html: string) => SlateValue
  __loadContent: (editor: unknown, content: { html?: string; content?: SlateValue }) => void
}

let cached: PatchedModule | null | undefined
let failure: string | null = null

function nodeRequire(): NodeRequire {
  // `typeof __filename` is NOT a reliable ESM/CJS discriminator. Under
  // `node -e` Node hands it to dynamically imported ESM modules with the bogus
  // value "[eval]", and `createRequire('[eval]')` then throws
  // ERR_INVALID_ARG_VALUE - which silently disabled this engine for every
  // one-liner. Only trust it when it is a real absolute path.
  const base =
    typeof __filename === 'string' && path.isAbsolute(__filename) ? __filename : import.meta.url
  return createRequire(base)
}

/** Record why the fast path is unavailable, and keep the `null` return terse. */
function unavailable(reason: string): null {
  failure = reason
  return null
}

/** A one-line message for anything that can be thrown. */
function describe(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * Why {@link loadPatchedModule} returned `null`, or `null` when it worked.
 * Surfaced in the `FALLBACK_ENGINE` warning so a silent downgrade in
 * production is diagnosable.
 */
export function getInternalEngineFailure(): string | null {
  loadPatchedModule()
  return failure
}

/** Walk up from a resolved entry until the wangEditor package.json is found. */
function findPackageRoot(start: string): string | null {
  let dir = start
  for (let depth = 0; depth < 8; depth += 1) {
    const manifest = path.join(dir, 'package.json')
    if (fs.existsSync(manifest)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(manifest, 'utf8')) as { name?: string }
        if (parsed.name === PACKAGE_NAME) return dir
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** The ESM bundle, preferring the documented `dist/index.mjs` location. */
function findBundle(root: string): string | null {
  const preferred = path.join(root, 'dist', 'index.mjs')
  if (fs.existsSync(preferred)) return preferred

  const dist = path.join(root, 'dist')
  if (!fs.existsSync(dist)) return null
  for (const file of fs.readdirSync(dist)) {
    if (!file.endsWith('.mjs')) continue
    const full = path.join(dist, file)
    const source = fs.readFileSync(full, 'utf8')
    if (PARSE_FN_RE.test(source) && LOAD_FN_RE.test(source)) return full
  }
  return null
}

/**
 * Build a patched copy of the bundle that also exports its internal parser, and
 * load it synchronously.
 *
 * A copy is used rather than the installed file because rewriting a dependency
 * in place would also rewrite pnpm's content-addressed store. `require()` of a
 * synchronous ESM module (Node >= 22.12) keeps the SDK's API synchronous.
 */
function buildPatchedModule(): PatchedModule | null {
  let localRequire: NodeRequire
  try {
    localRequire = nodeRequire()
  } catch (error) {
    return unavailable(`cannot resolve modules from the SDK location: ${describe(error)}`)
  }

  let entry: string
  try {
    entry = localRequire.resolve(PACKAGE_NAME)
  } catch {
    return unavailable(`${PACKAGE_NAME} is not installed (or not resolvable from the SDK)`)
  }

  const root = findPackageRoot(path.dirname(entry))
  if (!root) return unavailable(`could not locate the ${PACKAGE_NAME} package root`)
  const bundle = findBundle(root)
  if (!bundle) {
    return unavailable(
      `no ESM bundle under ${path.join(root, 'dist')} matches the expected function signatures`,
    )
  }

  const source = fs.readFileSync(bundle, 'utf8')
  const parseName = PARSE_FN_RE.exec(source)?.[1]
  const loadName = LOAD_FN_RE.exec(source)?.[1]
  if (!parseName || !loadName) {
    return unavailable(
      `the parser/loader functions in ${path.basename(bundle)} do not match the expected signatures`,
    )
  }

  const version = (() => {
    try {
      return (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string }).version ?? '0'
    } catch {
      return '0'
    }
  })()

  const patched =
    source.replace(/^\/\/# sourceMappingURL=.*$/m, '') +
    `\nexport { ${parseName} as __parseHtml, ${loadName} as __loadContent };\n`

  const hash = createHash('sha1').update(patched).digest('hex').slice(0, 12)
  const target = path.join(CACHE_DIR, `${PACKAGE_NAME.replace('/', '+')}-${version}-${hash}.mjs`)

  try {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true })
      // Write atomically: concurrent processes must never observe a partial file.
      const temp = `${target}.${process.pid}.tmp`
      fs.writeFileSync(temp, patched)
      fs.renameSync(temp, target)
    }
  } catch (error) {
    return unavailable(`could not write the patched bundle to ${CACHE_DIR}: ${describe(error)}`)
  }

  let mod: PatchedModule
  try {
    mod = localRequire(target) as PatchedModule
  } catch (error) {
    return unavailable(`could not require the patched bundle: ${describe(error)}`)
  }

  if (typeof mod.createEditor !== 'function') {
    return unavailable('the patched bundle does not export createEditor')
  }
  if (typeof mod.__loadContent !== 'function' || typeof mod.__parseHtml !== 'function') {
    return unavailable('the patched bundle does not export the parser/loader functions')
  }
  return mod
}

/**
 * The patched wangEditor module, or `null` when the fast path is unavailable
 * (unsupported bundle layout, read-only temp dir, or Node < 22.12). Call
 * {@link getInternalEngineFailure} for the reason.
 */
export function loadPatchedModule(): PatchedModule | null {
  if (cached === undefined) {
    try {
      cached = buildPatchedModule()
    } catch (error) {
      cached = unavailable(`unexpected failure while patching the bundle: ${describe(error)}`)
    }
  }
  return cached
}

/**
 * Engine backed by wangEditor's own loader, driven through a single headless
 * editor that is created once and reused for every document.
 */
export function createInternalEngine(): Engine | null {
  const mod = loadPatchedModule()
  if (!mod) return null

  // Headless: no selector, so nothing is rendered and `setHtml`/`destroy`
  // (which require a textarea) are never needed.
  //
  // Built on first use rather than here. `Boot.registerModule` installs a
  // module's `editorPlugin` only while an editor is being constructed, so an
  // editor created before the caller registers its custom modules would never
  // see them.
  let editor: EditorLike | null = null
  const instance = (): EditorLike => (editor ??= mod.createEditor({ html: '' }))

  return {
    kind: 'internal',
    module: mod,
    parse(html: string): SlateValue {
      try {
        const ed = instance()
        mod.__loadContent(ed, { html })
        return structuredClone(ed.children)
      } catch (error) {
        throw new TransformRuntimeError('wangEditor failed to parse the HTML', error)
      }
    },
    serialize(value: SlateValue): string {
      try {
        // A clone is mandatory: `getHtml()` caches per node object, so handing
        // it the caller's own nodes makes a later in-place edit return stale
        // HTML. Cloning also protects the caller's data from wangEditor.
        const ed = instance()
        ed.children = structuredClone(value)
        return ed.getHtml()
      } catch (error) {
        throw new TransformRuntimeError('wangEditor failed to render the Slate document', error)
      }
    },
    reset(): void {
      // Dropped, not destroyed: a headless editor has no textarea, so
      // `destroy()` throws. It is unreachable and reclaimed with the process.
      editor = null
    },
    dispose(): void {
      // A headless editor cannot be destroyed (`destroy()` needs a textarea),
      // so the instance is intentionally kept for the process lifetime.
    },
  }
}
