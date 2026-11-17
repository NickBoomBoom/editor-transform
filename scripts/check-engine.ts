/**
 * 引擎自检 / 升级 wangEditor 版本后的体检工具。
 *
 *   node --expose-gc scripts/check-engine.ts
 *
 * 三件事：
 *   1. 报出当前生效的引擎（internal 快通道还是 public 兜底）
 *   2. 采样堆增长，确认解析/渲染没有明显泄漏
 *   3. 探一遍标签支持度，看新版本是否开始丢内容
 *
 * 升级 `@wangeditor-next/editor` 之后跑一次，如果引擎掉到 public、
 * 或者标签矩阵有变，就说明 SDK 里的白名单或 patch 签名需要跟着更新。
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

import {
  DEFAULT_ALLOWED_TAGS,
  collectUnknownTags,
  disableBuiltinModules,
  disposeEngines,
  enableBuiltinModules,
  getEngineKind,
  getInternalEngineFailure,
  htmlToSlate,
  slateToHtml,
  type SlateValue,
} from '../src/node.ts'

// 第 4 节要展示「没注册模块时自定义节点会退化成 paragraph」，而 wangEditor 的注册表
// 只能加不能删，所以必须在任何一次转换之前把它关掉，之后再 enable 回来看对比。
disableBuiltinModules()

const ITERATIONS = Number(process.env.ITERATIONS ?? 2000)

/** 编辑器包版本（bundle 没有导出 version，直接从 package.json 读）。 */
const editorVersion = ((): string => {
  try {
    const require = createRequire(import.meta.url)
    return (require('@wangeditor-next/editor/package.json') as { version: string }).version
  } catch {
    return '(unknown)'
  }
})()

const SAMPLE_HTML = [
  '<h1>课程标题</h1>',
  '<p>这是一段<strong>加粗文本</strong>，还有<em>斜体</em>和<u>下划线</u>。</p>',
  '<ul><li>列表项一</li><li>列表项二</li></ul>',
  '<blockquote>引用一段话</blockquote>',
  '<table><tbody><tr><td>单元格</td></tr></tbody></table>',
].join('')

const line = (title: string): void => console.log(`\n${'─'.repeat(72)}\n${title}\n${'─'.repeat(72)}`)

const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(2)} MB`

const settle = (): number => {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('run with `node --expose-gc` so the heap can be sampled')
  }
  globalThis.gc()
  globalThis.gc()
  return process.memoryUsage().heapUsed
}

/* ------------------------------------------------------------- 1. 引擎信息 */
line('1 · 引擎')

const kind = getEngineKind()

console.log(`引擎:          ${kind}`)
console.log(`编辑器版本:    ${editorVersion}`)
if (kind === 'internal') {
  console.log(`快通道自检:    ok（${getInternalEngineFailure() === null ? '解析器与 loader 均已定位' : getInternalEngineFailure()}）`)
} else {
  console.log(`回退原因:      ${getInternalEngineFailure() ?? '(unknown)'}`)
  console.log('⚠ internal 快通道不可用，已回退到 public —— 解析会按每个文档约 28 KB 泄漏内存。')
  console.log('  多半是 wangEditor 换了版本、bundle 形状变了，需要核对 src/engine/internal.ts 里的两个正则。')
}

/* --------------------------------------------------------- 2. 内存采样 */
line(`2 · 内存（各 ${ITERATIONS} 次）`)

// 先热身，避免把 JIT 和首次惰性初始化的开销算进来。
const warmup: SlateValue = htmlToSlate(SAMPLE_HTML)
for (let i = 0; i < 50; i += 1) slateToHtml(warmup)

const beforeParse = settle()
for (let i = 0; i < ITERATIONS; i += 1) htmlToSlate(SAMPLE_HTML)
const afterParse = settle()

const beforeSerial = settle()
const value = htmlToSlate(SAMPLE_HTML)
for (let i = 0; i < ITERATIONS; i += 1) slateToHtml(value)
const afterSerial = settle()

const parsePerDoc = (afterParse - beforeParse) / ITERATIONS
const serialPerDoc = (afterSerial - beforeSerial) / ITERATIONS

console.log(`解析  ${ITERATIONS} 次:  ${mb(afterParse - beforeParse).padStart(9)}   ${(parsePerDoc / 1024).toFixed(2)} KB/次`)
console.log(`渲染  ${ITERATIONS} 次:  ${mb(afterSerial - beforeSerial).padStart(9)}   ${(serialPerDoc / 1024).toFixed(2)} KB/次`)
console.log(
  kind === 'internal'
    ? `\n参考值：internal 引擎解析约 0.5–1 KB/次、渲染约 0.2 KB/次（不是 0 是因为编辑器自身状态缓慢增长）。`
    : `\n参考值：public 引擎约 28 KB/次起步，属于已知的上游泄漏。`,
)

/* --------------------------------------------------------- 3. 标签矩阵 */
line('3 · 标签支持度')

// 「文字会不会被丢掉」是唯一有意义的判据：wangEditor 丢掉不认识的标签时会连内容一起丢。
const CANDIDATES = [
  'b', 'i', 'u', 's', 'em', 'strong', 'code', 'sub', 'sup', 'span', 'font', 'strike',
  'small', 'mark', 'ins', 'del', 'kbd', 'abbr', 'cite', 'q', 'samp', 'var', 'time',
  'big', 'tt', 'bdi', 'ruby',
  'p', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
  'figure', 'figcaption', 'dl', 'dt', 'dd', 'address', 'details', 'summary',
  'fieldset', 'form', 'center', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'blockquote',
]

const keeps: string[] = []
const drops: string[] = []

for (const tag of CANDIDATES) {
  const probe = `<p>a<${tag}>X</${tag}>b</p>`
  // 探针本身会制造大量预期内的 CONTENT_LOSS（块级标签被解析器从 <p> 里抬出去，
  // 尾部那个 b 就成了裸在块外的文字），这里静音，只关心 X 活不活。
  const text = JSON.stringify(htmlToSlate(probe, { onWarning: () => {} }))
  ;(text.includes('X') ? keeps : drops).push(tag)
}

console.log(`文字保留 (${keeps.length}):  ${keeps.join(' ')}`)
console.log(`文字丢失 (${drops.length}):  ${drops.join(' ')}`)

const drift = CANDIDATES.filter(
  (tag) => DEFAULT_ALLOWED_TAGS.has(tag) !== keeps.includes(tag),
)
if (drift.length > 0) {
  console.log(
    `\n⚠ 与 SDK 内置白名单不一致: ${drift.join(' ')}\n  DEFAULT_ALLOWED_TAGS（src/dom.ts）需要更新，否则 UNKNOWN_TAG 警告会误报或漏报。`,
  )
} else {
  console.log(`\n与 SDK 内置白名单（DEFAULT_ALLOWED_TAGS，${DEFAULT_ALLOWED_TAGS.size} 个标签）一致。`)
}

// 顺手校一下 collectUnknownTags 是否只报真正不支持的标签。
const stray = collectUnknownTags(SAMPLE_HTML, DEFAULT_ALLOWED_TAGS)
console.log(`示例 HTML 的未知标签: ${stray.length > 0 ? stray.join(' ') : '（无）'}`)

/* --------------------------------------------- 4. 二次开发编辑器自定义模块 */
line('4 · editor-v3 自定义模块')

/**
 * 后端拿到的 HTML 里会出现前端自定义的节点。不注册模块时它们会静默退化成
 * paragraph（属性一起丢），所以这一段检查「模块是否被打进产物、注册后是否生效」。
 */
const VENDOR = new URL('../dist/editor-v3-modules.mjs', import.meta.url)

if (!existsSync(VENDOR)) {
  console.log('未找到 dist/editor-v3-modules.mjs —— 先跑 `pnpm sync:editor-v3`（它必须在 build 之后）。')
} else {
  const vendor = (await import(VENDOR.href)) as {
    EDITOR_V3_SUMMARY: { modules: number; parseConfs: number; toHtmlConfs: number; types: string[] }
    EDITOR_V3_SOURCE: string
  }
  const { EDITOR_V3_SUMMARY: summary, EDITOR_V3_SOURCE: source } = vendor

  // 用他们 elemToHtml 的真实形状拼一段样张：answer-box 是 void 节点，内部不带文字。
  const customSample = [
    '<h1>任务单</h1>',
    '<div data-w-e-type="textParseTaskTitle">巡检任务 A</div>',
    '<div data-w-e-type="audio"><cp-audio-player src="/media/a.mp3" style="margin:0 auto;"/></div>',
    '<answer-box index="1"></answer-box>',
    '<div data-w-e-type="proxyBrowser" style="margin:8px 0;">'
      + '<proxy-browser object-id="obj-7"></proxy-browser></div>',
    '<div data-w-e-type="shadow-dom"><span style="color:red">影子内容</span></div>',
  ].join('')

  const customTypes = (html: string): string[] =>
    htmlToSlate(html, { onWarning: () => {} }).map((node) => node.type as string)

  // 内置模块此时是关掉的，所以这一次采样就是「裸 wangEditor」的行为。
  const before = customTypes(customSample)

  // 打开内置集合：SDK 平时就是在这个时机（首次转换前）自动装上的。
  const installed = enableBuiltinModules()

  const warnings: string[] = []
  const value = htmlToSlate(customSample, { onWarning: (w) => warnings.push(w.code) })
  const after = value.map((node) => node.type)
  const rendered = slateToHtml(value)

  console.log(`源码目录（只读）: ${source}`)
  console.log(`模块 ${summary.modules} 个 · 解析规则 ${summary.parseConfs} 条 · 序列化规则 ${summary.toHtmlConfs} 条`)
  console.log(`本次装入 ${installed.length} 条模块条目（含 shadow-dom 序列化修复）`)
  console.log(`自定义节点类型 ${summary.types.length} 个: ${summary.types.join(' ')}`)
  console.log(`\n注册前: ${before.join(', ')}`)
  console.log(`注册后: ${after.join(', ')}`)
  console.log(`警告:   ${[...new Set(warnings)].join(', ') || '（无）'}`)

  // 样张里出现过的 node type（div[data-w-e-type] 与自定义标签）才算预期；
  // 其余 15 个 textParse* 和 video 本来就不在这段样张里。
  const expected = [...customSample.matchAll(/data-w-e-type="([^"]+)"/g)].map((m) => m[1] as string)
  const missed = expected.filter((type) => !after.includes(type))
  if (missed.length > 0) {
    console.log(`\n⚠ 样张里出现、但没解析成自定义 type 的节点: ${missed.join(' ')}`)
    console.log('  说明内置模块没生效（disableBuiltinModules 之后没 enableBuiltinModules）。')
  } else {
    console.log(`\n样张里出现的 ${expected.length} 个自定义节点全部解析成功。`)
  }

  // editor-v3 的 shadow-dom 序列化会把对象 style 拼成 [object Object]；SDK 用
  // 「同 type 后注册覆盖」修（src/repairs.ts），它属于内置集合，默认生效。
  if (rendered.includes('[object Object]')) {
    console.log('\n⚠ shadow-dom 的 style 被序列化成 [object Object]：内置修复没生效。')
    console.log('  检查是否调了 disableBuiltinModules()，或用 registerModule(shadowDomSerializerRepair) 手动补上。')
  } else {
    console.log('\n自定义节点回写正常（含 shadow-dom 的 style），没有 [object Object] 之类的序列化缺陷。')
  }
}

disposeEngines()
