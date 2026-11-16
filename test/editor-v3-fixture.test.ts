import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

import {
  htmlToSlate,
  registerModule,
  slateToHtml,
  type SlateValue,
  type TransformWarning,
} from '../src/node.ts'

/**
 * The full editor-v3 fixture: one example of every node type the frontend can
 * emit, with the exact attribute/mark shapes its `parse-elem-html.ts` produces.
 *
 * `editor-v3-full.json` is the parse result of `editor-v3-full.html`, and both
 * files must stay in sync - regenerate the pair from the frontend source
 * (`pnpm sync:editor-v3`) whenever editor-v3 adds or reshapes a node.
 */

const fixtureDir = new URL('./fixtures/', import.meta.url)
const jsonUrl = new URL('editor-v3-full.json', fixtureDir)
const htmlUrl = new URL('editor-v3-full.html', fixtureDir)
const vendorUrl = new URL('../dist/editor-v3-modules.mjs', import.meta.url)

const hasVendor = existsSync(vendorUrl)

/** README「修上游 `elemToHtml` 的缺陷」里的补丁，逐字对齐。 */
const shadowDomRepair = {
  elemsToHtml: [
    {
      type: 'shadow-dom',
      elemToHtml(elem: Record<string, unknown>) {
        const doms = Array.isArray(elem.doms) ? (elem.doms as Record<string, unknown>[]) : []
        const inner = doms
          .map((dom) => {
            const tag = String(dom.tag ?? 'span')
            const attrs = Object.entries((dom.attrs ?? {}) as Record<string, unknown>)
              .map(([key, raw]) => {
                const value =
                  raw && typeof raw === 'object'
                    ? Object.entries(raw as Record<string, unknown>)
                        .map(([p, v]) => `${p}: ${v}`)
                        .join('; ')
                    : String(raw)
                return ` ${key}="${value}"`
              })
              .join('')
            return `<${tag}${attrs}>${String(dom.html ?? '')}</${tag}>`
          })
          .join('')
        return `<div data-w-e-type="shadow-dom">${inner}</div>`
      },
    },
  ],
}

test(
  'the editor-v3 fixture round-trips through both directions',
  { skip: hasVendor ? false : 'run `pnpm sync:editor-v3` to generate dist/editor-v3-modules.mjs' },
  async () => {
    const { editorV3NodeModules } = (await import(vendorUrl.href)) as {
      editorV3NodeModules: unknown[]
    }
    for (const mod of editorV3NodeModules) registerModule(mod)
    // Later registrations win, so the repair must come after the bundled modules.
    registerModule(shadowDomRepair)

    const fixtureJson = JSON.parse(readFileSync(jsonUrl, 'utf8')) as SlateValue
    const fixtureHtml = readFileSync(htmlUrl, 'utf8').trimEnd()

    // HTML is the source of truth; the JSON is what a backend stores. The
    // comparison happens on the JSON form because the parser leaves a few
    // `undefined` properties on nodes (table rows carry `caption`/`height`),
    // and `JSON.stringify` is what a backend actually persists.
    const parsed = JSON.parse(JSON.stringify(htmlToSlate(fixtureHtml))) as SlateValue
    assert.deepEqual(parsed, fixtureJson, 'parsing the fixture HTML should reproduce the fixture JSON')

    // The bundled `shadow-dom` serializer writes style objects as `[object Object]`
    // and drops the space between attributes; the repair makes the pair lossless.
    const rendered = slateToHtml(fixtureJson)
    assert.equal(rendered, fixtureHtml, 'rendering the fixture JSON should reproduce the fixture HTML')

    const warnings: TransformWarning[] = []
    htmlToSlate(fixtureHtml, { onWarning: (w) => warnings.push(w) })
    assert.deepEqual(warnings, [], 'the fixture must not rely on unknown-tag or content-loss fallbacks')
  },
)
