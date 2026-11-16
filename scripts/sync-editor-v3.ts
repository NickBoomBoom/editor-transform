/**
 * 从二次开发的编辑器（editor-v3）里提取「自定义节点」的 HTML <-> Slate 规则，
 * 打包成后端与 demo 都能直接加载的 ESM 产物。
 *
 * 只读取源仓库，绝不写入。产物生成到本 SDK 仓库内：
 *   - dist/editor-v3-modules.mjs   给后端（随包发布）
 *   - demo/vendor/editor-v3-modules.js  给测试页（浏览器）
 *
 * 为什么需要打包而不是直接 import：
 *   editor-v3 的源码用的是 Vite 风格的无扩展名导入（./custom-types），
 *   Node 的 ESM 解析器不接受；而且各 module 的 index.ts 会连带引入
 *   render-elem.tsx（Vue）、menu（UI）与 .scss。
 *   这里只挑 parse-elem-html / elem-to-html / plugin 三类纯逻辑文件，
 *   绕开 index.ts，再用 esbuild 解析扩展名。
 *
 * 用法：
 *   pnpm sync:editor-v3
 *   EDITOR_V3_DIR=/path/to/editor-v3 pnpm sync:editor-v3
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULT_SRC =
  '/Users/mac/Documents/code/jcjy/sd-pc-front/src/components-base/editor-v3'

const SRC = path.resolve(process.env.EDITOR_V3_DIR ?? DEFAULT_SRC)

/** 每个自定义节点模块的三类纯逻辑文件，缺一不可容忍（video 就没有 parse）。 */
const PART_FILES = {
  parse: 'parse-elem-html.ts',
  toHtml: 'elem-to-html.ts',
  plugin: 'plugin.ts',
} as const

type Part = keyof typeof PART_FILES

interface DiscoveredModule {
  name: string
  parts: Partial<Record<Part, string>>
}

function discover(): DiscoveredModule[] {
  const moduleDir = path.join(SRC, 'module')
  if (!fs.existsSync(moduleDir)) {
    throw new Error(
      `找不到 editor-v3 的 module 目录：${moduleDir}\n` +
        `用 EDITOR_V3_DIR 环境变量指向正确的 editor-v3 目录。`,
    )
  }

  const found: DiscoveredModule[] = []
  for (const entry of fs.readdirSync(moduleDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const parts: Partial<Record<Part, string>> = {}
    for (const [part, file] of Object.entries(PART_FILES) as Array<[Part, string]>) {
      const candidate = path.join(moduleDir, entry.name, file)
      if (fs.existsSync(candidate)) parts[part] = candidate
    }
    if (Object.keys(parts).length > 0) found.push({ name: entry.name, parts })
  }

  if (found.length === 0) {
    throw new Error(`在 ${moduleDir} 下没有发现任何 parse-elem-html/elem-to-html/plugin 文件`)
  }
  return found
}

/**
 * 生成入口源码。各模块导出的名字并不统一（parseHtmlConf / parseTextParseHtmlConfs /
 * audioToHtmlConf …），所以不按名字取，而是在运行时按“形状”识别：
 *   parse 配置  = { selector: string, parseElemHtml: Function }
 *   toHtml 配置 = { type: string, elemToHtml: Function }
 * 这样对方重命名导出也不会静默漏掉规则。
 */
function generateEntry(modules: DiscoveredModule[]): string {
  const lines: string[] = [
    '// 由 scripts/sync-editor-v3.ts 生成，请勿手改。',
    '/* eslint-disable */',
    '',
  ]

  modules.forEach((mod, index) => {
    for (const part of ['parse', 'toHtml', 'plugin'] as Part[]) {
      const file = mod.parts[part]
      if (file) lines.push(`import * as ${part}${index} from ${JSON.stringify(file)}`)
    }
  })

  lines.push(
    '',
    'const isParseConf = (v) =>',
    '  !!v && typeof v === "object" && typeof v.selector === "string" && typeof v.parseElemHtml === "function"',
    'const isToHtmlConf = (v) =>',
    '  !!v && typeof v === "object" && typeof v.type === "string" && typeof v.elemToHtml === "function"',
    '',
    'function collect(ns, test) {',
    '  const out = []',
    '  for (const value of Object.values(ns ?? {})) {',
    '    if (Array.isArray(value)) {',
    '      for (const item of value) if (test(item)) out.push(item)',
    '    } else if (test(value)) {',
    '      out.push(value)',
    '    }',
    '  }',
    '  return out',
    '}',
    '',
    '/** 把多个 editorPlugin 串成一条链；每个插件只处理自己认识的 type，顺序无关。 */',
    'function composePlugins(plugins) {',
    '  if (plugins.length === 0) return undefined',
    '  return (editor) => plugins.reduce((acc, plugin) => plugin(acc), editor)',
    '}',
    '',
    'export const editorV3NodeModules = []',
    'const allParse = []',
    'const allToHtml = []',
    'const allSelectors = []',
    'const allTypes = []',
    '',
  )

  modules.forEach((mod, index) => {
    const hasParse = Boolean(mod.parts.parse)
    const hasToHtml = Boolean(mod.parts.toHtml)
    const hasPlugin = Boolean(mod.parts.plugin)

    lines.push(`{`)
    lines.push(`  const parse = ${hasParse ? `collect(parse${index}, isParseConf)` : '[]'}`)
    lines.push(`  const toHtml = ${hasToHtml ? `collect(toHtml${index}, isToHtmlConf)` : '[]'}`)
    lines.push(`  const plugins = ${hasPlugin ? `[plugin${index}.default].filter((p) => typeof p === "function")` : '[]'}`)
    lines.push('  allParse.push(...parse)')
    lines.push('  allToHtml.push(...toHtml)')
    lines.push('  for (const conf of parse) allSelectors.push(conf.selector)')
    lines.push('  for (const conf of toHtml) allTypes.push(conf.type)')
    lines.push('  editorV3NodeModules.push({')
    lines.push('    parseElemsHtml: parse,')
    lines.push('    elemsToHtml: toHtml,')
    lines.push('    editorPlugin: composePlugins(plugins),')
    lines.push('  })')
    lines.push('}')
  })

  lines.push(
    '',
    '/** 已识别的自定义节点类型（后端可用来做白名单/自检）。 */',
    'export const EDITOR_V3_CUSTOM_TYPES = [...new Set(allTypes)].sort()',
    '',
    '/** 已识别的解析选择器：HTML 里出现这些而没注册模块，就是配置漏了。 */',
    'export const EDITOR_V3_PARSE_SELECTORS = [...new Set(allSelectors)].sort()',
    '',
    '/** 生成来源，方便排查「demo 用的是哪份源码」。 */',
    `export const EDITOR_V3_SOURCE = ${JSON.stringify(SRC)}`,
    '',
    'export const EDITOR_V3_SUMMARY = {',
    '  modules: editorV3NodeModules.length,',
    '  parseConfs: allParse.length,',
    '  toHtmlConfs: allToHtml.length,',
    '  types: EDITOR_V3_CUSTOM_TYPES,',
    '  selectors: EDITOR_V3_PARSE_SELECTORS,',
    '}',
    '',
  )

  return lines.join('\n')
}

/**
 * 手写声明文件：产物是 esbuild 直接打出来的 .mjs，没有类型。
 * 类型故意宽松 —— 这些函数来自另一个仓库，签名随业务演进。
 */
const DECLARATION = `// 由 scripts/sync-editor-v3.ts 生成，请勿手改。
/** 一条 HTML -> Slate 的解析规则。 */
export interface EditorV3ParseConf {
  selector: string
  parseElemHtml: (elem: Element, children: unknown[]) => unknown
}

/** 一条 Slate -> HTML 的序列化规则。 */
export interface EditorV3ToHtmlConf {
  type: string
  elemToHtml: (elem: Record<string, unknown>, childrenHtml: string, editor: unknown) => string
}

export interface EditorV3NodeModule {
  parseElemsHtml: EditorV3ParseConf[]
  elemsToHtml: EditorV3ToHtmlConf[]
  editorPlugin?: (editor: never) => never
}

/** 可直接逐个交给 registerModule() 的模块列表。 */
export declare const editorV3NodeModules: EditorV3NodeModule[]

/** 已识别的自定义节点类型。 */
export declare const EDITOR_V3_CUSTOM_TYPES: string[]

/** 已识别的解析选择器。 */
export declare const EDITOR_V3_PARSE_SELECTORS: string[]

/** 生成时读取的源码目录。 */
export declare const EDITOR_V3_SOURCE: string

export declare const EDITOR_V3_SUMMARY: {
  modules: number
  parseConfs: number
  toHtmlConfs: number
  types: string[]
  selectors: string[]
}
`

async function bundle(entrySource: string, outfile: string): Promise<void> {
  await esbuild.build({
    stdin: {
      contents: entrySource,
      loader: 'ts',
      resolveDir: ROOT,
      sourcefile: 'editor-v3-modules.generated.ts',
    },
    bundle: true,
    format: 'esm',
    target: 'es2022',
    // 不打包编辑器本体：后端与 demo 都必须和 SDK 用同一个副本，否则
    // 插件里的 DomEditor/SlateTransforms 会作用到另一个实例上。
    external: ['@wangeditor-next/editor'],
    outfile,
    logLevel: 'warning',
  })
}

async function main(): Promise<void> {
  const modules = discover()
  const entry = generateEntry(modules)

  const distOut = path.join(ROOT, 'dist', 'editor-v3-modules.mjs')
  const demoOut = path.join(ROOT, 'demo', 'vendor', 'editor-v3-modules.js')

  fs.mkdirSync(path.dirname(distOut), { recursive: true })
  fs.mkdirSync(path.dirname(demoOut), { recursive: true })

  await bundle(entry, distOut)
  await bundle(entry, demoOut)

  const distTypes = path.join(ROOT, 'dist', 'editor-v3-modules.d.mts')
  fs.writeFileSync(distTypes, DECLARATION, 'utf8')

  const kb = (p: string): string => `${(fs.statSync(p).size / 1024).toFixed(1)} KB`

  console.log(`源目录: ${SRC}`)
  console.log(`发现模块: ${modules.map((m) => m.name).join(', ')}`)
  for (const mod of modules) {
    const parts = (['parse', 'toHtml', 'plugin'] as Part[])
      .filter((p) => mod.parts[p])
      .join('+')
    console.log(`  - ${mod.name}: ${parts}`)
  }
  console.log(`产物: dist/editor-v3-modules.mjs (${kb(distOut)})`)
  console.log(`产物: dist/editor-v3-modules.d.mts`)
  console.log(`产物: demo/vendor/editor-v3-modules.js (${kb(demoOut)})`)
}

main().catch((error: unknown) => {
  console.error(`[sync:editor-v3] ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
