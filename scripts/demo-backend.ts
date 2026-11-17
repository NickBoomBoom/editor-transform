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
 * editor-v3 二次开发编辑器的自定义节点（audio / answer-box / proxyBrowser /
 * shadow-dom / textParse*）由 SDK 在首次转换时自动注册，这里不需要手动注册；
 * 只有 dist/editor-v3-modules.mjs 缺失时它们才会静默退化成 paragraph（属性一起丢）。
 */
import { existsSync, readFileSync } from 'node:fs'

import {
  getEngineKind,
  htmlToSlate,
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

/* --------------------- 0. editor-v3 自定义模块（SDK 自动注册，这里只报数量） */
const vendorUrl = new URL('../dist/editor-v3-modules.mjs', import.meta.url)
const wantsEditorV3 = process.argv.includes('--editor-v3')

if (existsSync(vendorUrl)) {
  // 只读元信息用于打印。模块本身由 SDK 在第一次转换时装上：require() 与 import
  // 同一个文件返回同一个模块实例，所以这里 import 一遍不会重复注册。
  const vendor = (await import(vendorUrl.href)) as {
    EDITOR_V3_SUMMARY: { modules: number; parseConfs: number; toHtmlConfs: number; types: string[] }
  }
  const { modules, parseConfs, toHtmlConfs } = vendor.EDITOR_V3_SUMMARY
  console.log(
    `editor-v3 自定义模块已内置：${modules} 个模块 / ${parseConfs} 条解析规则 / ` +
      `${toHtmlConfs} 条序列化规则（首次转换时自动注册，无需 registerModule）`,
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

if (!identical && !original.includes('[object Object]')) {
  // 剩下的差异通常只是样式属性的空格规范化（color:red → color: red），把第一处
  // 不同指出来，免得读者以为是内容丢了。
  const at = [...html].findIndex((char, index) => char !== original[index])
  console.log(`  第一处差异在第 ${at} 个字符（一般只是样式的空格规范化）：`)
  console.log(`    输入: …${html.slice(Math.max(0, at - 30), at + 25)}…`)
  console.log(`    输出: …${original.slice(Math.max(0, at - 30), at + 25)}…`)
}

if (original.includes('[object Object]')) {
  // 内置修复在「同 type 后注册覆盖」的规则里：parse 阶段 style 被
  // styleStringToObject 转成对象，editor-v3 自己的 elemToHtml 却直接拼
  // `${attrs[key]}`。走到这里说明修复没生效（例如调过 disableBuiltinModules）。
  console.log('\n⚠ 仍检测到 shadow-dom 的 style 被序列化成 [object Object]：内置修复没生效。')
} else if (html.includes('shadow-dom')) {
  console.log('\nshadow-dom 的样式由 SDK 内置的序列化修复处理，没有 [object Object]。')
}
