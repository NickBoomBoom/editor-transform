import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  disposeEngines,
  getEditorApi,
  getEngineKind,
  htmlToSlate,
  slateToHtml,
} from '../src/node.ts'
import { getInternalEngineFailure } from '../src/engine/internal.ts'

const HTML = '<h1>标题</h1><p>正文<strong>加粗</strong></p><ul><li>一</li><li>二</li></ul>'

const gc = (globalThis as { gc?: () => void }).gc

test('the internal engine exposes the module it parses with', () => {
  const api = getEditorApi()
  assert.ok(api, 'expected an editor module')
  assert.equal(typeof api.createEditor, 'function')
})

test('the fastest available engine is the leak-free one', () => {
  assert.equal(getEngineKind(), 'internal')
  assert.equal(getInternalEngineFailure(), null)
})

/**
 * `node -e` hands a bogus `__filename` ("[eval]") to dynamically imported ESM
 * modules, which made a bare `typeof __filename !== 'undefined'` probe throw
 * ERR_INVALID_ARG_VALUE and silently drop the fast path for every one-liner.
 * Run the exact shape documented in the README.
 */
test('the internal engine survives being loaded from `node -e`', () => {
  const entry = pathToFileURL(fileURLToPath(new URL('../src/node.ts', import.meta.url))).href
  const output = execFileSync(
    process.execPath,
    ['-e', `import(${JSON.stringify(entry)}).then((m) => console.log(m.getEngineKind()))`],
    { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8' },
  )
  assert.equal(output.trim(), 'internal')
})

/**
 * The whole point of the internal engine. `createEditor({ html })` retains
 * ~28 KB per call on 6.6.2 and cannot be released, which rules the documented
 * API out for a long-running backend; parsing through the patched loader keeps
 * the heap flat. Run with `node --expose-gc`.
 */
test('parsing and rendering 1000 documents does not grow the heap', { skip: !gc }, () => {
  const reference = htmlToSlate(HTML)
  const input = JSON.parse(JSON.stringify(reference))

  for (let i = 0; i < 200; i += 1) {
    htmlToSlate(HTML)
    slateToHtml(input)
  }

  gc?.()
  gc?.()
  const before = process.memoryUsage().heapUsed

  for (let i = 0; i < 1000; i += 1) {
    htmlToSlate(HTML)
    slateToHtml(input)
  }

  gc?.()
  gc?.()
  const deltaMb = (process.memoryUsage().heapUsed - before) / 1024 / 1024

  assert.ok(deltaMb < 8, `heap grew by ${deltaMb.toFixed(2)} MB over 1000 round-trips`)
})

test('engines are rebuilt after disposeEngines()', () => {
  disposeEngines()
  assert.deepEqual(htmlToSlate(HTML), htmlToSlate(HTML))
  disposeEngines()
  assert.equal(slateToHtml(htmlToSlate('<p>after dispose</p>')), '<p>after dispose</p>')
})
