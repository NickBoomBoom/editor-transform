import assert from 'node:assert/strict'
import { test } from 'node:test'

import { TransformInputError } from '../src/errors.ts'
import { createTransformer, htmlToSlate, slateToHtml } from '../src/node.ts'

test('non-string HTML is rejected with an actionable message', () => {
  for (const bad of [undefined, null, 42, {}, [], true]) {
    assert.throws(
      () => htmlToSlate(bad as unknown as string),
      (error: unknown) => {
        assert.ok(error instanceof TransformInputError, `expected TransformInputError for ${String(bad)}`)
        assert.match(error.message, /^html must be a string, received /)
        return true
      },
    )
  }
})

test('malformed Slate documents are rejected before wangEditor sees them', () => {
  assert.throws(() => slateToHtml('nope' as never), TransformInputError)
  assert.throws(() => slateToHtml([{ text: 'top level text' }] as never), TransformInputError)
  assert.throws(() => slateToHtml([{ type: 'paragraph', children: [] }] as never), TransformInputError)
  assert.throws(() => slateToHtml([{ type: 'paragraph', children: [{ nope: 1 }] }] as never), TransformInputError)
})

test('validation reports the offending path', () => {
  try {
    slateToHtml([{ type: 'paragraph', children: [{ text: 'ok' }, { bad: true }] as never }])
    assert.fail('expected a throw')
  } catch (error) {
    assert.ok(error instanceof TransformInputError)
    assert.match(error.message, /value\[0\]\.children\[1\]/)
  }
})

test('createTransformer binds options and stays usable after dispose', () => {
  const warnings: string[] = []
  const transformer = createTransformer({ onWarning: (w) => warnings.push(w.code) })

  const value = transformer.htmlToSlate('<p>a<mark>X</mark>b</p>')
  assert.deepEqual(warnings, ['UNKNOWN_TAG', 'CONTENT_LOSS'])

  assert.equal(transformer.slateToHtml(value), '<p>ab</p>')

  transformer.dispose()
  assert.equal(transformer.slateToHtml(transformer.htmlToSlate('<p>after</p>')), '<p>after</p>')
})

test('per-call options win over transformer options', () => {
  const seen: string[] = []
  const transformer = createTransformer({ onWarning: (w) => seen.push(`transformer:${w.code}`) })
  transformer.htmlToSlate('<p>a<mark>X</mark>b</p>', { onWarning: (w) => seen.push(`call:${w.code}`) })
  assert.deepEqual(seen, ['call:UNKNOWN_TAG', 'call:CONTENT_LOSS'])
})
