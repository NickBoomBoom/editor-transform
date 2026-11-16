import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ContentLossError } from '../src/errors.ts'
import { htmlToSlate, htmlToText, slateToHtml, type TransformWarning } from '../src/node.ts'

const collect = (): { warnings: TransformWarning[]; sink: (w: TransformWarning) => void } => {
  const warnings: TransformWarning[] = []
  return { warnings, sink: (w) => warnings.push(w) }
}

test('unknown inline tags are reported as content loss', () => {
  const { warnings, sink } = collect()
  const value = htmlToSlate('<p>a<mark>KEEP</mark>b</p>', { onWarning: sink })

  // wangEditor drops the element *and* its text - the whole reason the SDK
  // checks the output against the input.
  assert.deepEqual(value, [{ type: 'paragraph', children: [{ text: 'a' }, { text: 'b' }] }])

  const codes = warnings.map((w) => w.code).sort()
  assert.deepEqual(codes, ['CONTENT_LOSS', 'UNKNOWN_TAG'])

  const loss = warnings.find((w) => w.code === 'CONTENT_LOSS')
  assert.equal((loss?.detail as { droppedText: string }).droppedText, 'KEEP')

  const unknown = warnings.find((w) => w.code === 'UNKNOWN_TAG')
  assert.deepEqual(unknown?.detail, ['mark'])
})

test('every unsupported tag is caught, supported ones stay quiet', () => {
  const lossy = [
    'mark', 'ins', 'del', 'kbd', 'small', 'abbr', 'cite', 'q', 'var',
    'audio', 'svg', 'canvas', 'picture', 'object', 'map',
  ]
  for (const tag of lossy) {
    const { warnings, sink } = collect()
    htmlToSlate(`<p>a<${tag}>X</${tag}>b</p>`, { onWarning: sink })
    assert.ok(
      warnings.some((w) => w.code === 'CONTENT_LOSS'),
      `<${tag}> should be reported as content loss`,
    )
  }

  // wangEditor unwraps these but keeps their text, so they must stay quiet.
  for (const tag of ['span', 'font', 'strike', 'sub', 'sup', 'u', 'code', 'a']) {
    const { warnings, sink } = collect()
    htmlToSlate(`<p>a<${tag}>X</${tag}>b</p>`, { onWarning: sink })
    assert.equal(warnings.length, 0, `<${tag}> should not warn, got ${JSON.stringify(warnings)}`)
  }
  for (const tag of ['section', 'article', 'dl', 'dt', 'dd', 'address', 'center', 'details', 'h1', 'h6', 'pre', 'blockquote']) {
    const { warnings, sink } = collect()
    htmlToSlate(`<div>a<${tag}>X</${tag}>b</div>`, { onWarning: sink })
    assert.equal(warnings.length, 0, `<${tag}> should not warn, got ${JSON.stringify(warnings)}`)
  }
})

test('text outside any block element is reported as loss', () => {
  // The HTML parser lifts `<section>` out of a `<p>`, leaving a bare text node
  // that wangEditor discards - a realistic shape for hand-built fragments.
  const { warnings, sink } = collect()
  htmlToSlate('<p>a<section>X</section>b</p>', { onWarning: sink })
  assert.ok(
    warnings.some((w) => w.code === 'CONTENT_LOSS'),
    `expected a content-loss warning, got ${JSON.stringify(warnings)}`,
  )

  const trailing = collect()
  htmlToSlate('<p>正文</p>尾部文字', { onWarning: trailing.sink })
  assert.ok(
    trailing.warnings.some((w) => w.code === 'CONTENT_LOSS'),
    'expected trailing bare text to be reported',
  )
})

test('dropped content is reported in source order', () => {
  const { warnings, sink } = collect()
  htmlToSlate('<p>这里是<mark>高亮文字</mark>，后面还有正文。</p>', { onWarning: sink })
  const loss = warnings.find((w) => w.code === 'CONTENT_LOSS')
  assert.equal((loss?.detail as { droppedText: string }).droppedText, '高亮文字')
})

test('strict mode turns content loss into an error', () => {
  assert.throws(
    () => htmlToSlate('<p>a<mark>KEEP</mark>b</p>', { strict: true, onWarning: () => {} }),
    (error: unknown) => {
      assert.ok(error instanceof ContentLossError)
      assert.equal(error.droppedText, 'KEEP')
      assert.deepEqual(error.unknownTags, ['mark'])
      return true
    },
  )

  // Clean input passes strict mode untouched.
  assert.doesNotThrow(() => htmlToSlate('<p>fine</p>', { strict: true }))
})

test('empty results are reported', () => {
  const { warnings, sink } = collect()
  assert.equal(slateToHtml([], { onWarning: sink }), '')
  assert.deepEqual(warnings.map((w) => w.code), ['EMPTY_RESULT'])
})

test('htmlToText ignores script and style content', () => {
  assert.equal(htmlToText('<p>a</p><script>var x = 1</script><style>p{color:red}</style>'), 'a')
  assert.equal(htmlToText('<p>a &amp; b</p>'), 'a & b')
})
