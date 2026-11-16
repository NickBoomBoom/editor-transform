import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  disposeEngines,
  htmlToSlate,
  registerModule,
  slateToHtml,
  type TransformWarning,
} from '../src/node.ts'

/**
 * Custom node types, exercised through the public API only.
 *
 * The rules here mirror the shape a real second-developed editor uses - a void
 * node whose payload lives in an attribute, and an inline tag rewritten to a
 * mark - so the test covers the wiring without depending on any other repo.
 */

/** `<callout kind="info">` ⇄ `{ type: 'callout', kind }`, payload in an attribute. */
const calloutModule = {
  parseElemsHtml: [
    {
      selector: 'callout',
      parseElemHtml: (elem: Element) => ({
        type: 'callout',
        kind: elem.getAttribute('kind') ?? 'info',
        children: [{ text: '' }],
      }),
    },
  ],
  elemsToHtml: [
    {
      type: 'callout',
      elemToHtml: (elem: Record<string, unknown>) => `<callout kind="${String(elem.kind)}"></callout>`,
    },
  ],
  editorPlugin: (editor: unknown) => editor,
}

/** `<hi>` becomes a `bold` mark, so the tag itself never reaches the output. */
const inlineModule = {
  parseElemsHtml: [
    {
      selector: 'hi',
      parseElemHtml: (elem: Element) => ({ text: elem.textContent ?? '', bold: true }),
    },
  ],
}

const CALLED = '<p>前</p><callout kind="warn"></callout><p>后</p>'

test('a registered module is honoured by both engines', () => {
  registerModule(calloutModule)

  for (const engine of ['internal', 'public'] as const) {
    const value = htmlToSlate(CALLED, { engine })
    assert.deepEqual(
      value[1],
      { type: 'callout', kind: 'warn', children: [{ text: '' }] },
      `${engine}: the custom type should survive parsing`,
    )
    assert.equal(slateToHtml(value, { engine }), CALLED, `${engine}: the custom type should round-trip`)
  }
})

test('an unregistered custom element collapses to a paragraph', () => {
  // A fresh process would be needed to truly unregister; this documents the
  // failure mode that makes registerModule mandatory.
  const value = htmlToSlate('<p>前</p><not-registered kind="x"></not-registered><p>后</p>')
  assert.equal(value[1]?.type, 'paragraph')
})

test('a tag the renderer reproduces is not reported as unknown', () => {
  const warnings: TransformWarning[] = []
  htmlToSlate(CALLED, { onWarning: (w) => warnings.push(w) })

  // `<callout>` is unknown to the built-in tag list, but the registered
  // serializer emits it again, so nothing was lost and nothing is reported.
  assert.deepEqual(warnings, [])
})

test('a tag rewritten into a mark needs allowedTags to stay quiet', () => {
  registerModule(inlineModule)
  const html = '<p>a<hi>X</hi>b</p>'

  const noisy: TransformWarning[] = []
  const value = htmlToSlate(html, { onWarning: (w) => noisy.push(w) })
  assert.deepEqual(value, [{ type: 'paragraph', children: [{ text: 'a' }, { text: 'X', bold: true }, { text: 'b' }] }])
  // The content survived, but `<hi>` never comes back, so it is worth flagging.
  assert.deepEqual(noisy.map((w) => w.code), ['UNKNOWN_TAG'])

  const quiet: TransformWarning[] = []
  htmlToSlate(html, { onWarning: (w) => quiet.push(w), allowedTags: ['hi'] })
  assert.deepEqual(quiet, [])
})

test('registering a serializer for an existing type overrides the earlier one', () => {
  const html = '<callout kind="warn"></callout>'

  // wangEditor keeps `ol[type] = elemToHtml`, so the last registration wins.
  // This is the supported way to repair a wrong `elemToHtml` in a custom module
  // without touching the module's own repository.
  registerModule({
    elemsToHtml: [
      { type: 'callout', elemToHtml: () => '<callout kind="fixed" data-patched="1"></callout>' },
    ],
  })

  assert.equal(slateToHtml(htmlToSlate(html)), '<callout kind="fixed" data-patched="1"></callout>')
})

test('registering the same module twice is a no-op', () => {
  // Registration is not idempotent inside wangEditor (menus and render-elems are
  // pushed into arrays), so replaying onto a rebuilt engine must not reinstall.
  const before = slateToHtml(htmlToSlate(CALLED))
  registerModule(calloutModule)
  registerModule(calloutModule)
  disposeEngines()
  assert.equal(slateToHtml(htmlToSlate(CALLED)), before)
})
