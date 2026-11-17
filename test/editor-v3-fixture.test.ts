import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import { htmlToSlate, slateToHtml, type SlateValue, type TransformWarning } from '../src/node.ts'

/**
 * The full editor-v3 fixture: one example of every node type the frontend can
 * emit, with the exact attribute/mark shapes its `parse-elem-html.ts` produces.
 *
 * `editor-v3-full.json` is the parse result of `editor-v3-full.html`, and both
 * files must stay in sync - regenerate the pair from the frontend source
 * (`pnpm sync:editor-v3`) whenever editor-v3 adds or reshapes a node.
 *
 * Nothing is registered here on purpose: the Node entry point installs the
 * editor-v3 modules, and the `shadow-dom` serializer repair, by itself. The
 * byte-exact render below is what proves it - the bundled rule alone writes
 * `style="[object Object]"`.
 */

const fixtureDir = new URL('./fixtures/', import.meta.url)
const jsonUrl = new URL('editor-v3-full.json', fixtureDir)
const htmlUrl = new URL('editor-v3-full.html', fixtureDir)
const vendorUrl = new URL('../dist/editor-v3-modules.mjs', import.meta.url)

const hasVendor = existsSync(vendorUrl)

test(
  'the editor-v3 fixture round-trips through both directions',
  { skip: hasVendor ? false : 'run `pnpm sync:editor-v3` to generate dist/editor-v3-modules.mjs' },
  () => {
    const fixtureJson = JSON.parse(readFileSync(jsonUrl, 'utf8')) as SlateValue
    const fixtureHtml = readFileSync(htmlUrl, 'utf8').trimEnd()

    // HTML is the source of truth; the JSON is what a backend stores. The
    // comparison happens on the JSON form because the parser leaves a few
    // `undefined` properties on nodes (table rows carry `caption`/`height`),
    // and `JSON.stringify` is what a backend actually persists.
    const parsed = JSON.parse(JSON.stringify(htmlToSlate(fixtureHtml))) as SlateValue
    assert.deepEqual(parsed, fixtureJson, 'parsing the fixture HTML should reproduce the fixture JSON')

    // The bundled `shadow-dom` serializer writes style objects as `[object Object]`
    // and drops the space between attributes; the built-in repair makes the pair
    // lossless.
    const rendered = slateToHtml(fixtureJson)
    assert.equal(rendered, fixtureHtml, 'rendering the fixture JSON should reproduce the fixture HTML')

    const warnings: TransformWarning[] = []
    htmlToSlate(fixtureHtml, { onWarning: (w) => warnings.push(w) })
    assert.deepEqual(warnings, [], 'the fixture must not rely on unknown-tag or content-loss fallbacks')
  },
)
