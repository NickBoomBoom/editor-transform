/**
 * 后端侧完整链路演示：HTML → Slate JSON → 后端处理 → HTML
 *
 * 跑的是和线上后端同一条路径：`internal` 引擎（复用 wangEditor 自己的解析
 * 器，零泄漏）。
 *
 *   node scripts/demo-backend.ts                    # 用内置示例
 *   node scripts/demo-backend.ts --editor-v3        # 用 editor-v3 二次开发编辑器的真实产物
 *   node scripts/demo-backend.ts payload.html       # 用文件里的 HTML
 *
 * 只要 dist/editor-v3-modules.mjs 存在就会自动注册二次开发编辑器的自定义节点，
 * 否则 audio / answer-box / proxyBrowser / shadow-dom / textParse* 会静默退化成
 * paragraph（属性一起丢）。
 */
import { existsSync, readFileSync } from 'node:fs'

import {
  getEngineKind,
  htmlToSlate,
  registerModule,
  slateToHtml,
  type SlateNode,
  type SlateValue,
  type TransformWarning,
} from '../src/node.ts'

const SAMPLE = [
  '<h1>课程标题</h1>',
  '<p>这是一段<strong>加粗文本</strong>，还有<em>斜体</em>和<u>下划线</u>。</p>',
  '<ul><li>列表项一</li><li>列表项二</li></ul>',
  '<blockquote>引用一段话</blockquote>',
].join('')

/** editor-v3 的 getHtml() 真实产物（严格按他们的 elemToHtml 拼）。 */
const EDITOR_V3_SAMPLE = [
  '<h1>任务单</h1>',
  '<div data-w-e-type="textParseTaskTitle">巡检任务 A</div>',
  '<div data-w-e-type="textParseTaskContent">请于今日 18:00 前完成这段文本。</div>',
  '<div data-w-e-type="audio"><cp-audio-player src="/media/a.mp3" style="margin:0 auto;"/></div>',
  '<answer-box index="1"></answer-box>',
  '<div data-w-e-type="proxyBrowser" style="margin:8px 0;">'
    + '<proxy-browser object-id="obj-7"></proxy-browser></div>',
  '<div data-w-e-type="shadow-dom"><span style="color:red">影子内容</span></div>',
  '<p>普通段落</p>',
].join('')

const line = (title: string): void => {
  console.log(`\n${'─'.repeat(72)}\n${title}\n${'─'.repeat(72)}`)
}

/* ------------------------------------- 0. 注册二次开发编辑器的自定义模块 */
const vendorUrl = new URL('../dist/editor-v3-modules.mjs', import.meta.url)
const wantsEditorV3 = process.argv.includes('--editor-v3')

if (existsSync(vendorUrl)) {
  const vendor = (await import(vendorUrl.href)) as {
    editorV3NodeModules: unknown[]
    EDITOR_V3_SUMMARY: { modules: number; parseConfs: number; toHtmlConfs: number; types: string[] }
  }
  for (const mod of vendor.editorV3NodeModules) registerModule(mod)
  const { modules, parseConfs, toHtmlConfs } = vendor.EDITOR_V3_SUMMARY
  console.log(
    `已注册 editor-v3 自定义模块：${modules} 个模块 / ${parseConfs} 条解析规则 / ${toHtmlConfs} 条序列化规则`,
  )
} else if (wantsEditorV3) {
  console.log('找不到 dist/editor-v3-modules.mjs —— 先跑 `pnpm sync:editor-v3`（必须在 build 之后）。')
}

const fileArg = process.argv.slice(2).find((arg) => !arg.startsWith('--'))
const html = fileArg
  ? readFileSync(fileArg, 'utf8')
  : wantsEditorV3
    ? EDITOR_V3_SAMPLE
    : SAMPLE

/* ------------------------------------------------ 1. 前端 getHtml() 的产物 */
line('1 · 收到的 HTML（前端 getHtml() 的输出）')
console.log(html)

/* ---------------------------------------------------- 2. SDK：HTML → Slate */
line('2 · htmlToSlate() → 交给后端的 Slate JSON')

const warnings: TransformWarning[] = []
const value: SlateValue = htmlToSlate(html, {
  onWarning: (warning) => warnings.push(warning),
})

console.log(JSON.stringify(value, null, 2))
console.log(`\n引擎: ${getEngineKind()}  顶层节点: ${value.length}`)

if (warnings.length > 0) {
  console.log('\n警告:')
  for (const warning of warnings) console.log(`  [${warning.code}] ${warning.message}`)
} else {
  console.log('警告: 无（内容没有丢失）')
}

/* ------------------------------------------------------- 3. 模拟后端处理 */
line('3 · 后端处理：改文本 + 追加节点')

const processed: SlateValue = structuredClone(value)
let rewritten = 0
let retyped = 0

const walk = (nodes: SlateNode[]): void => {
  for (const node of nodes) {
    // 自定义节点的属性同样可以改：这里把答题框的序号 +1，演示后端改结构属性。
    if (node.type === 'insert-answer-box' && typeof node.index === 'number') {
      node.index += 1
      retyped += 1
    }
    if (Array.isArray(node.children)) {
      walk(node.children)
      continue
    }
    if (typeof node.text === 'string' && node.text.includes('文本')) {
      node.text = node.text.replace(/文本/g, '【后端改写】文本')
      rewritten += 1
    }
  }
}
walk(processed)

processed.push({ type: 'header3', children: [{ text: '↑ 由后端追加的标题' }] })

console.log(`改写 ${rewritten} 处文本，调整 ${retyped} 个自定义节点属性，追加 1 个 header3 节点`)
console.log(JSON.stringify(processed, null, 2))

/* ---------------------------------------------------- 4. SDK：Slate → HTML */
line('4 · slateToHtml() → 返回给前端的 HTML')

const roundTripWarnings: TransformWarning[] = []
const out = slateToHtml(processed, { onWarning: (warning) => roundTripWarnings.push(warning) })

console.log(out)
if (roundTripWarnings.length > 0) {
  for (const warning of roundTripWarnings) console.log(`  [${warning.code}] ${warning.message}`)
}

/* --------------------------------------------------------- 5. 无损性自检 */
line('5 · 无损性自检')

const original = slateToHtml(value)
const identical = original === html
console.log('原样往返是否与输入逐字节一致:', identical)
console.log('输入长度:', html.length, ' 输出长度:', out.length)

if (original.includes('[object Object]')) {
  // 这是 editor-v3 自身 elemToHtml 的缺陷：parse 阶段 style 被
  // styleStringToObject 转成对象，序列化时却直接拼 `${attrs[key]}`。
  // wangEditor 的注册表是 `ol[type] = elemToHtml`，后注册覆盖先注册 ——
  // 所以不用改他们的仓库也能修好。
  console.log('\n检测到 shadow-dom 的 style 被序列化成 [object Object]（editor-v3 自身的缺陷）。')
  registerModule({
    elemsToHtml: [
      {
        type: 'shadow-dom',
        elemToHtml: (elem: Record<string, unknown>): string => {
          const doms = Array.isArray(elem.doms) ? (elem.doms as Record<string, unknown>[]) : []
          const inner = doms
            .map((dom) => {
              const attrs = Object.entries((dom.attrs ?? {}) as Record<string, unknown>)
                .map(([key, raw]) => {
                  const text =
                    raw && typeof raw === 'object'
                      ? Object.entries(raw as Record<string, unknown>)
                          .map(([prop, val]) => `${prop}: ${val}`)
                          .join('; ')
                      : String(raw)
                  return ` ${key}="${text}"`
                })
                .join('')
              return `<${String(dom.tag)}${attrs}>${String(dom.html)}</${String(dom.tag)}>`
            })
            .join('')
          return `<div data-w-e-type="shadow-dom">${inner}</div>`
        },
      },
    ],
  })
  const patched = slateToHtml(value)
  if (patched === html) {
    console.log('覆盖 shadow-dom 的序列化后: 与输入逐字节一致')
  } else {
    // 剩下的差异通常只是样式属性的空格规范化（color:red → color: red），
    // 把第一处不同指出来，免得读者以为是内容丢了。
    const at = [...html].findIndex((char, index) => char !== patched[index])
    console.log(`覆盖 shadow-dom 的序列化后: 仍有差异，第一处在第 ${at} 个字符`)
    console.log(`  输入: …${html.slice(Math.max(0, at - 30), at + 25)}…`)
    console.log(`  输出: …${patched.slice(Math.max(0, at - 30), at + 25)}…`)
  }
  console.log(patched)
}
