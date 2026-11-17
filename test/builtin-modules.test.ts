import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { test } from 'node:test'

import {
  disableBuiltinModules,
  enableBuiltinModules,
  htmlToSlate,
  slateToHtml,
} from '../src/node.ts'

/**
 * The built-in module set: installed without being asked for, and switchable.
 *
 * `disableBuiltinModules()` has to run before the first conversion in this
 * process - wangEditor's registry can only be added to, so there is no way back
 * once a rule is in. That is exactly why this file exists: it is the only place
 * where the degraded "bare wangEditor" behaviour can still be observed.
 */

const vendorUrl = new URL('../dist/editor-v3-modules.mjs', import.meta.url)
const hasVendor = existsSync(vendorUrl)

disableBuiltinModules()

const SAMPLE = '<h1>任务单</h1><div data-w-e-type="textParseTaskTitle">巡检任务 A</div>'

const typesOf = (html: string): string[] =>
  htmlToSlate(html, { onWarning: () => {} }).map((node) => node.type as string)

test(
  'the built-in modules install themselves, and the switch turns them off',
  { skip: hasVendor ? false : 'run `pnpm sync:editor-v3` to generate dist/editor-v3-modules.mjs' },
  () => {
    // Disabled: a node type only the frontend knows about collapses.
    assert.deepEqual(typesOf(SAMPLE), ['header1', 'paragraph'])

    enableBuiltinModules()

    // Enabled: the same HTML keeps its custom type, with no event to opt in.
    assert.deepEqual(typesOf(SAMPLE), ['header1', 'textParseTaskTitle'])
  },
)

test('the shadow-dom serializer repair is part of the built-in set', { skip: hasVendor ? false : true }, () => {
  // The bundled rule writes the (object-valued) style as `[object Object]`; the
  // repair is registered after it and therefore wins.
  const rendered = slateToHtml([
    {
      type: 'shadow-dom',
      doms: [{ tag: 'span', attrs: { class: 'x', style: { color: 'red' } }, html: '影子内容' }],
      children: [{ text: '' }],
    },
  ] as never)

  assert.equal(rendered, '<div data-w-e-type="shadow-dom"><span class="x" style="color: red">影子内容</span></div>')
})
