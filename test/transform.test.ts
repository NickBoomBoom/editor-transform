import assert from 'node:assert/strict'
import { test } from 'node:test'

import { getEngineKind, htmlToSlate, slateToHtml } from '../src/node.ts'
import type { SlateElement } from '../src/types.ts'

/** Compact HTML is what `editor.getHtml()` produces, so it must round-trip. */
const ROUND_TRIP = [
  '<h1>课程标题</h1><p>这是一段<strong>加粗文本</strong></p>',
  '<p><em>斜体</em>与<u>下划线</u>和<s>删除</s>以及<code>代码</code></p>',
  '<p><sub>下</sub><sup>上</sup></p>',
  '<ul><li>一</li><li>二</li></ul><ol><li>甲</li></ol>',
  '<blockquote>引用</blockquote>',
  '<p>第一行<br>第二行</p>',
  '<h6>六级标题</h6>',
  '<p><span style="font-size: 12px;">小字</span></p>',
]

test('html -> slate -> html is byte-identical for getHtml() output', () => {
  for (const html of ROUND_TRIP) {
    const value = htmlToSlate(html)
    assert.equal(slateToHtml(value), html, `round-trip failed for ${html}`)
  }
})

test('parsing is idempotent', () => {
  for (const html of ROUND_TRIP) {
    const once = htmlToSlate(html)
    const twice = htmlToSlate(slateToHtml(once))
    assert.deepEqual(twice, once, `not idempotent for ${html}`)
  }
})

test('maps wangEditor node types and marks', () => {
  assert.deepEqual(htmlToSlate('<h1>课程标题</h1><p>这是一段<strong>加粗文本</strong></p>'), [
    { type: 'header1', children: [{ text: '课程标题' }] },
    { type: 'paragraph', children: [{ text: '这是一段' }, { text: '加粗文本', bold: true }] },
  ])
})

test('maps lists, quotes, dividers and text marks', () => {
  assert.deepEqual(htmlToSlate('<ul><li>一</li></ul><ol><li>甲</li></ol>'), [
    { type: 'list-item', ordered: false, level: 0, children: [{ text: '一' }] },
    { type: 'list-item', ordered: true, level: 0, children: [{ text: '甲' }] },
  ])
  assert.deepEqual(htmlToSlate('<blockquote>引用</blockquote>'), [
    { type: 'blockquote', children: [{ text: '引用' }] },
  ])
  assert.deepEqual(htmlToSlate('<hr>'), [{ type: 'divider', children: [{ text: '' }] }])
  assert.deepEqual(htmlToSlate('<p><s>删除</s></p>'), [
    { type: 'paragraph', children: [{ text: '删除', through: true }] },
  ])
})

test('tables, images and links keep their payload', () => {
  const [table] = htmlToSlate('<table><tbody><tr><td>单元格</td></tr></tbody></table>')
  assert.equal(table?.type, 'table')
  assert.deepEqual((table as SlateElement).columnWidths, [90])

  const [paragraph] = htmlToSlate('<p><img src="https://x/a.png" alt="图" width="10" height="20"></p>')
  assert.deepEqual(paragraph, {
    type: 'paragraph',
    children: [
      {
        type: 'image',
        src: 'https://x/a.png',
        alt: '图',
        href: '',
        style: { width: '10', height: '20' },
        width: '10',
        height: '20',
        children: [{ text: '' }],
      },
    ],
  })

  const [linkParagraph] = htmlToSlate('<p><a href="https://example.com">链接</a></p>')
  assert.deepEqual(linkParagraph, {
    type: 'paragraph',
    children: [
      {
        type: 'link',
        url: 'https://example.com',
        target: '',
        children: [{ text: '链接' }],
      },
    ],
  })
})

test('empty input yields the same default paragraph wangEditor uses', () => {
  const expected = [{ type: 'paragraph', children: [{ text: '' }] }]
  assert.deepEqual(htmlToSlate(''), expected)
  assert.deepEqual(htmlToSlate('<p></p>'), expected)
  // wangEditor renders an empty paragraph as `<p><br></p>`.
  assert.equal(slateToHtml(expected), '<p><br></p>')
})

test('pretty-printed HTML does not create junk paragraphs', () => {
  const pretty = '\n<h1>标题</h1>\n<p>正文</p>\n'
  assert.deepEqual(htmlToSlate(pretty), [
    { type: 'header1', children: [{ text: '标题' }] },
    { type: 'paragraph', children: [{ text: '正文' }] },
  ])

  // The raw behaviour is still reachable, and documents why normalisation exists.
  const raw = htmlToSlate(pretty, { normalizeHtml: false })
  assert.ok(raw.length > 2, 'expected wangEditor to emit padding paragraphs')
})

test('normalisation keeps <pre> contents and inline spacing intact', () => {
  const html = '<pre><code>const a = 1\nconst b = 2</code></pre>'
  assert.equal(htmlToSlate(html, { normalizeHtml: false })[0]?.type, 'pre')
  assert.deepEqual(htmlToSlate(html), htmlToSlate(html, { normalizeHtml: false }))

  assert.deepEqual(htmlToSlate('<p><strong>a</strong> <em>b</em></p>'), [
    {
      type: 'paragraph',
      children: [{ text: 'a', bold: true }, { text: ' ' }, { text: 'b', italic: true }],
    },
  ])
})

test('re-rendering mutated nodes never returns cached HTML', () => {
  const value = htmlToSlate('<p>one</p>')
  assert.equal(slateToHtml(value), '<p>one</p>')

  // In-place edit of the very same node objects: `getHtml()` caches per node
  // object, so an un-cloned implementation would still return `<p>one</p>`.
  const [paragraph] = value
  ;(paragraph as SlateElement).children = [{ text: 'two' }]
  assert.equal(slateToHtml(value), '<p>two</p>')
})

test('slateToHtml does not mutate the caller document', () => {
  const value = htmlToSlate('<p>原文</p>')
  const snapshot = JSON.parse(JSON.stringify(value))
  slateToHtml(value)
  assert.deepEqual(value, snapshot)
})

test('the Node entry uses the internal engine', () => {
  assert.equal(getEngineKind(), 'internal')
  assert.equal(getEngineKind('auto'), 'internal')
  assert.equal(getEngineKind('public'), 'public')
})
