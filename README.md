# editor-transform

把 **wangEditor-next** 的 `getHtml()` 转成 **Slate JSON** 交给后端解析，后端改完之后再转回 HTML。

解析和渲染都走 **wangEditor-next 自己的规则**（也就是 `createEditor()` 内部那条 HTML → Slate 链路），
SDK 不重新实现一遍 HTML 解析器 —— 这样前后端的节点结构、mark、样式规范化永远一致。

> 这个 SDK 是给 `sd-pc-front` 里那套二次开发的编辑器（`src/components-base/editor-v3`）用的：
> 它自带 6 个自定义节点模块（`audio`、`insert-answer-box`、`proxyBrowser`、`shadow-dom`、
> 16 种 `textParse*`、`video`），SDK 能把它们的解析与序列化规则从源码里打包出来注册进引擎 ——
> 见 [对接二次开发编辑器（editor-v3）](#对接二次开发编辑器editor-v3)。
> 自定义节点不注册的话会静默退化成 `paragraph`，所以这一步不能省。

```js
import { htmlToSlate, slateToHtml } from "editor-transform";

// 前端 getHtml()
const html = "<h1>课程标题</h1><p>这是一段<strong>加粗文本</strong></p>";

// 后端解析
const value = htmlToSlate(html);
// [ { type: 'header1', children: [ { text: '课程标题' } ] },
//   { type: 'paragraph', children: [ { text: '这是一段' }, { text: '加粗文本', bold: true } ] } ]

// 后端处理 value（改文本、加节点、删节点都行），再写回 HTML
const out = slateToHtml(value);
```

---

## 特性

|                      |                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| **零内存泄漏**       | Node 后端默认走 `internal` 引擎，1000 次解析 + 渲染堆增长 < 8 MB（`createEditor({ html })` 每次泄漏约 28 KB） |
| **丢内容检测**       | wangEditor 遇到不认识的标签会**连文字一起丢掉**，SDK 会把解析结果和输入对比并报出丢掉的字符                   |
| **前后端同版本解析** | 不自己写解析器，用的就是 `@wangeditor-next/editor` 的产物                                                     |
| **类型完整**         | TypeScript 编写，ESM + CJS + `.d.ts`，`strict` 模式                                                           |
| **输入校验**         | 非字符串 HTML、坏掉的 Slate 结构都会抛出可读的错误，而不是 wangEditor 的 `t.indexOf is not a function`        |

---

## 安装

```bash
pnpm add editor-transform @wangeditor-next/editor
```

Node 环境还需要 `jsdom` 与 `global-jsdom`（包主入口会自动 `import 'global-jsdom/register'`）：

```bash
pnpm add jsdom global-jsdom
```

> **版本一致性**：前后端请使用相同版本的 `@wangeditor-next/editor`，否则 HTML 解析规则可能不一致。
> 本 SDK 在 `6.6.2` 上完整验证。

---

## 快速开始

### Node / 后端

```js
// 主入口会先注册 jsdom，再加载 wangEditor，顺序由 SDK 保证
import { htmlToSlate, registerModule, slateToHtml } from "editor-transform";

// ① 先注册 editor-v3 的自定义节点（只有 6 个模块，注册一次，进程内全局生效）。
//    不注册的话 audio / answer-box / shadow-dom / textParse* 会静默退化成 paragraph。
import { editorV3NodeModules } from "editor-transform/editor-v3-modules";
for (const mod of editorV3NodeModules) registerModule(mod);

// ② 正常转换
const value = htmlToSlate(frontendHtml, {
  onWarning: (w) => logger.warn(w.code, w.message),
});

// … 后端处理 value …
const html = slateToHtml(value);
```

`editor-transform/editor-v3-modules` 是 `pnpm sync:editor-v3` 生成的产物（把前端仓库里
editor-v3 的解析/序列化/插件规则打包出来），所以这个包需要打进后端镜像 —— 见
[对接二次开发编辑器（editor-v3）](#对接二次开发编辑器editor-v3)。

### 浏览器 / 前端

```js
import { htmlToSlate, slateToHtml } from "editor-transform/browser";
```

浏览器入口只用 wangEditor 公开 API（DOM 本来就有，不需要 jsdom）。

### 一次性绑定配置

```js
import { createTransformer } from "editor-transform";

const tx = createTransformer({
  strict: true, // 丢内容直接抛错
  onWarning: (w) => sentry.captureMessage(w.message),
});

tx.htmlToSlate(html);
tx.slateToHtml(value);
tx.dispose(); // 释放池化的编辑器实例
```

---

## 两个引擎（重要）

SDK 有两个引擎，`engine` 选项可显式指定，默认 `auto`。

### `internal`（Node 默认，推荐）

直接调用 wangEditor 打包产物内部那两段函数：HTML → Slate 的解析器，以及
`createEditor()` 自己装载内容用的 loader。它们在 bundle 里没有导出、名字也被压缩过，
SDK 用**函数签名**把它们找出来（`6.6.2` 上已验证），把副本 patch 成一个临时 ESM 文件，
再用 `require()` 同步加载（Node ≥ 22.12 支持 `require(esm)`）。

解析和渲染都复用**同一个 headless 编辑器实例**：

```js
editor.children = structuredClone(value); // 渲染
editor.getHtml();

loadContent(editor, { html }); // 解析
editor.children;
```

实测（各 2000 次）：解析 **+1.01 MB**、渲染 **+0.42 MB**，即每个文档约 0.5 KB / 0.2 KB。

### `public`（兜底 / 浏览器）

按官方文档用 `createEditor({ html })` 解析、`editor.children` 取 Slate JSON。

**它在 `6.6.2` 上每个文档泄漏约 28 KB，且没有任何办法释放**：

| 路径                           | 每文档泄漏 |
| ------------------------------ | ---------- |
| `createEditor({ html })`       | ~28 KB     |
| 带 selector 引导 + `setHtml()` | ~70 KB     |
| 带 selector + `destroy()`      | ~200 KB    |

`destroy()` 在 headless 下还会抛 `Cannot find textarea instance by editor`。
所以 `internal` 不可用时才回退到它，并且会发一次 `FALLBACK_ENGINE` 警告（**带上具体原因**，
不会让你在线上猜为什么快通道没了）。
浏览器里没有别的选择，用 `public` 没问题（页面每次刷新都会回收进程内存）。

```js
import { getEngineKind, getInternalEngineFailure } from "editor-transform";

getEngineKind(); // 'internal' | 'public'
getInternalEngineFailure(); // null 表示快通道正常；否则是原因字符串，适合打进启动日志
```

---

## 内容安全：不允许静默丢内容

wangEditor 会把**不认识的标签连同文字一起丢掉**：

```html
<p>a<mark>KEEP</mark>b</p>
→ 文本变成 "ab"
```

后端如果不知道这件事，就会静默丢数据。SDK 每次解析都把输出文本和输入文本做对比：

```js
htmlToSlate("<p>a<mark>KEEP</mark>b</p>", { onWarning: console.log });
// [UNKNOWN_TAG]  Unsupported tag(s) <mark>; wangEditor drops their content
// [CONTENT_LOSS] Content was dropped while parsing: "KEEP"
```

`CONTENT_LOSS` 的 `detail` 里有完整报告：

```ts
{
  inputText: 'aKEEPb',
  outputText: 'ab',
  droppedText: 'KEEP',       // 按原文顺序，多段之间用 " … " 连接
}
```

打开 `strict` 时改为抛 `ContentLossError`（带 `droppedText` 与 `unknownTags`）。

**同一份 HTML 里裸在块级元素外面的文字也会被丢掉**，比如 `<p>正文</p>尾部文字`
或 `<p>a<section>X</section>b</p>` —— 一样会被 `CONTENT_LOSS` 抓到。

---

## 支持的标签

以 `6.6.2` 实测为准（`<p>a<TAG>X</TAG>b</p>` 探针）：

| 类别               | 标签                                                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 有对应节点         | `h1`–`h6`、`p`、`blockquote`、`pre`+`code`、`ul`/`ol`/`li`、`hr`、`a`、`img`、`table` 全家桶、`video`、`iframe`                                                              |
| 有对应 mark        | `strong`/`b`、`em`/`i`、`u`、`s`/`strike`、`sub`、`sup`、`code`、`span`（`style` 里的 `color`、`font-size`、`font-family`）、`font`                                          |
| 会被拆开但文字保留 | `div`、`section`、`article`、`aside`、`header`、`footer`、`main`、`nav`、`figure`、`figcaption`、`dl`/`dt`/`dd`、`address`、`center`、`details`/`summary`、`fieldset`/`form` |
| **丢失（含文字）** | `mark`、`ins`、`del`、`kbd`、`small`、`abbr`、`cite`、`q`、`samp`、`var`、`time`、`big`、`tt`、`bdi`、`ruby`、`audio`、`canvas`、`svg`、`picture`、`object`、`map`           |

`htmlToSlate()` 的 `UNKNOWN_TAG` 警告就是按这张表报的，可以自己覆盖：

```js
import { collectUnknownTags, DEFAULT_ALLOWED_TAGS } from "editor-transform";
```

---

## 手工拼接 / 美化的 HTML

真实 `getHtml()` 的输出是紧凑的一行；如果你拿到的是缩进美化过的 HTML，
wangEditor 会为标签之间的换行和缩进生成多余的空段落：

```js
htmlToSlate("\n<h1>标题</h1>\n<p>正文</p>\n");
// 默认（normalizeHtml: true）→ 2 个节点
// { normalizeHtml: false }  → 8 个节点，其中一堆 {"text":""}
```

默认开启归一化：折叠跨行的标签间空白，`<pre>` / `<textarea>` 内容原样保留，
不跨行的行内空格（`<strong>a</strong> <em>b</em>`）也不会被吃掉。

---

## 自定义节点

前端注册了自定义 wangEditor 模块时，后端必须注册完全相同的模块，否则该节点会**静默退化成
`paragraph`**，`type` 和属性一起丢（因为外层的 `div` 还在，文字侥幸留下，连 `CONTENT_LOSS`
都不会报，只有 `UNKNOWN_TAG`）。

`internal` 引擎用的是 bundle 的**副本**，所以不要直接 `import { Boot } from '@wangeditor-next/editor'`
去注册（那注册到的是另一个实例），用 SDK 的 API：

```js
import { registerModule, getEditorApi } from "editor-transform";

registerModule(MyCustomModule); // 注册到引擎实际使用的那个实例
getEditorApi(); // 需要别的扩展点时取模块命名空间
```

`registerModule` 会把模块同时装到 `internal` 与 `public` 两个实例上，并丢弃池化编辑器让
`editorPlugin` 重新执行（wangEditor 只在构造编辑器时应用插件，`isVoid` 之类因此需要重建）。
同一个模块对象重复注册是 no-op。**在第一次 `htmlToSlate`/`slateToHtml` 之前注册**最省事，
之后注册也没问题，只是要多付一次编辑器重建。

选择器与 `type` 都注册成什么，可以用后注册覆盖前注册来修上游模块自身的缺陷 —— 见下面的例子。

### 对接二次开发编辑器（editor-v3）

`sd-pc-front/src/components-base/editor-v3` 里的 `audio`、`insert-answer-box`、`proxy-browser`、
`shadow-dom`、`video` 和 16 个 `textParse*` 都是自定义节点。前端源码是 Vite 风格的无扩展名导入，
Node 直接 import 会报 `ERR_MODULE_NOT_FOUND`，所以用打包脚本在前端仓库**之外**生成一份模块：

```bash
# 默认读 /Users/mac/Documents/code/jcjy/sd-pc-front/src/components-base/editor-v3
# 也可以用 EDITOR_V3_DIR 指到别处；脚本只读源仓库，不会改它
pnpm sync:editor-v3

node scripts/check-engine.ts      # 体检：模块是否生效、有没有序列化缺陷
node scripts/demo-backend.ts --editor-v3
```

产物：

| 文件 | 用途 |
| --- | --- |
| `dist/editor-v3-modules.mjs` | 后端用，随包发布（`editor-transform/editor-v3-modules`） |
| `dist/editor-v3-modules.d.mts` | 类型声明 |
| `demo/vendor/editor-v3-modules.js` | 浏览器测试页用 |

> `tsup` 会清空 `dist`，所以 `sync:editor-v3` 必须在 `build` 之后跑（`pnpm demo` 已经帮你串好）。

后端这样用：

```js
import { htmlToSlate, registerModule, slateToHtml } from "editor-transform";
import { editorV3NodeModules } from "editor-transform/editor-v3-modules";

for (const mod of editorV3NodeModules) registerModule(mod);

const value = htmlToSlate(editorGetHtml);
// [{ type: 'textParseTaskTitle', children: [...] },
//  { type: 'audio', src: '/media/a.mp3', children: [{ text: '' }] },
//  { type: 'insert-answer-box', index: 1, children: [{ text: '' }] },
//  { type: 'proxyBrowser', objectId: 'obj-7', children: [{ text: '' }] },
//  { type: 'shadow-dom', doms: [{ tag: 'span', attrs: { style: { color: 'red' } }, html: '影子内容' }], ... }]
slateToHtml(value); // 回到他们的 HTML
```

脚本按**形状**识别导出（`typeof selector === 'string' && typeof parseElemHtml === 'function'`，
`typeof type === 'string' && typeof elemToHtml === 'function'`），不依赖导出名，模块目录里加了
新节点会自动带上。它只收 `parse-elem-html.ts` / `elem-to-html.ts` / `plugin.ts`，不碰 `index.ts`，
因此不会把 `.tsx` 菜单、`.scss` 或浏览器专用的 `proxy-browser/shadowdom.ts`（模块求值时就
`customElements.define`）带进来。

### 修上游 `elemToHtml` 的缺陷（不改他们的仓库）

`editor-v3` 的 `shadow-dom` 有一个真实缺陷：`parse-elem-html.ts` 用 `styleStringToObject` 把
`style` 转成了对象，`elem-to-html.ts` 却直接拼 `` `${attrs[key]}` ``，于是回写成
`<span style="[object Object]">`（而且属性之间没有空格分隔）。

wangEditor 的注册表是 `ol[type] = elemToHtml`、`jc[selector] = parseElemHtml`，**后者覆盖前者**，
所以注册一条同 `type` 的规则就能修好：

```js
registerModule({
  elemsToHtml: [
    {
      type: "shadow-dom",
      elemToHtml(elem) {
        const doms = Array.isArray(elem.doms) ? elem.doms : [];
        const inner = doms
          .map((dom) => {
            const attrs = Object.entries(dom.attrs ?? {})
              .map(([key, raw]) => {
                const value =
                  raw && typeof raw === "object"
                    ? Object.entries(raw).map(([p, v]) => `${p}: ${v}`).join("; ")
                    : String(raw);
                return ` ${key}="${value}"`; // 注意这里补了空格
              })
              .join("");
            return `<${dom.tag}${attrs}>${dom.html}</${dom.tag}>`;
          })
          .join("");
        return `<div data-w-e-type="shadow-dom">${inner}</div>`;
      },
    },
  ],
});
```

`scripts/demo-backend.ts` 会把「覆盖前 / 覆盖后」的差异打出来（`--editor-v3` 时会自动做）。

---

## API

```ts
htmlToSlate(html: string, options?: TransformOptions): SlateValue
slateToHtml(value: SlateValue, options?: TransformOptions): string
createTransformer(options?: TransformOptions): Transformer
configure(options: TransformOptions): void      // 设置全局默认值
setEngineFactory(factory: EngineFactory): void  // 换掉引擎实现
registerModule(mod: unknown, mode?: EngineMode): void
getEditorApi(mode?: EngineMode): EditorModule | null
getEngineKind(mode?: EngineMode): 'internal' | 'public'
getInternalEngineFailure(): string | null       // 快通道不可用的原因，正常时 null
disposeEngines(): void
```

```ts
interface TransformOptions {
  engine?: "auto" | "internal" | "public"; // 默认 'auto'
  normalizeHtml?: boolean; // 默认 true
  allowedTags?: readonly string[]; // 额外认为「已被处理」的标签，见下
  onWarning?: (warning: TransformWarning) => void;
  strict?: boolean; // 丢内容/未知标签时抛错
}
```

警告码：`FALLBACK_ENGINE`、`CONTENT_LOSS`、`UNKNOWN_TAG`、`EMPTY_RESULT`。

`allowedTags` 只在一个场景下需要：自定义标签被解析规则**改写成别的标签**。比如注册了
`selector: "hi"` → `{ bold: true }`，输出是 `<strong>X</strong>`，`<hi>` 不会回来，
SDK 会报 `UNKNOWN_TAG`；传 `allowedTags: ["hi"]` 就静默了。其余情况 SDK 自己就能判断：
**渲染结果里能复现的标签就是被理解的**，不需要额外声明。

行为约定：

- `htmlToSlate('')` / `htmlToSlate('<p></p>')` → `[{ type: 'paragraph', children: [{ text: '' }] }]`
  （和 wangEditor 空文档一致），写回 HTML 是 `<p><br></p>`。
- `slateToHtml([])` → `''`，并发一条 `EMPTY_RESULT`；`slateToHtml` 不会改动传入的数组。
- `slateToHtml` 每次都对入参做深拷贝。wangEditor 的 `getHtml()` 按**节点对象**缓存，
  不拷贝的话，「渲染一次 → 就地改节点 → 再渲染」会拿到旧的 HTML。
- 文档根层必须是元素节点，`[{ text: 'x' }]` 或 `[{ type: 'p', children: [] }]` 会抛 `TransformInputError`。
- 丢内容检测的基线是**回写后的 HTML 文本**（不是 Slate 文本）：这样把文字存在自定义属性里的
  节点（如 `shadow-dom.doms[].html`）不会被误判成丢失。`ContentLossReport.outputText` 因此是
  渲染结果的可见文本。代价是每次解析多一次渲染（约 0.25 ms）。

---

## 开发

```bash
pnpm install
pnpm typecheck      # tsc --noEmit
pnpm test           # node --expose-gc --test "test/**/*.test.ts"（35 个用例）
pnpm build          # tsup（ESM+CJS）+ tsc（d.ts）
```

测试直接跑 `.ts`（Node 原生类型擦除），其中包含两条针对这套引擎命门的回归测试：

- **堆增长**：1000 次解析 + 渲染，堆增长超过 8 MB 就失败。
- **`node -e` 加载**：`node -e` 会把 `__filename` 设成 `"[eval]"` 传给动态 import 的 ESM 模块，
  早期版本因此在这条路径上静默退化成泄漏的 `public` 引擎；这条测试起一个子进程复现它。
- **editor-v3 全量 fixture**：`test/fixtures/editor-v3-full.html` 一个文件里放了 16 个 `textParse*`、
  6 个自定义节点和内置的块级/行内样式，`editor-v3-full.json` 是它的解析结果；测试要求两个方向都
  原样还原，并且不产生任何告警。这两个文件依赖 `pnpm sync:editor-v3` 的产物，`dist` 里没有
  `editor-v3-modules.mjs` 时该用例自动跳过。

### 体检 / 升级工具

```bash
pnpm check          # node --expose-gc scripts/check-engine.ts
```

报出当前生效的引擎与原因、采样 2000 次解析/渲染的堆增长、并重跑一遍标签支持度矩阵，
和 SDK 内置白名单比对。**升级 `@wangeditor-next/editor` 之后跑一次**，
如果引擎掉到 `public` 或标签矩阵有漂移，就说明白名单或 patch 签名要跟着更新。

### 测试页

```bash
pnpm demo           # build + sync:editor-v3 + 起静态服务 → http://localhost:6754/
```

（端口被占用时换一个：`PORT=5199 pnpm demo`。）

页面就是三步，只做 editor-v3 的链路：

1. **HTML** —— 贴一段 editor-v3 的 `getHtml()` 输出（默认填好的是全量样张：16 个 `textParse*`、6 个自定义节点和全部内置样式）
2. **Slate JSON** —— 点「转为 JSON」得到后端拿到的数据，可以直接手改
3. **渲染结果** —— 点「转为 HTML」把 JSON 转回 HTML，左边显示源码，右边实时渲染

自定义节点的 6 个模块在页面加载时自动注册（用 `demo/vendor/editor-v3-modules.js`），
不注册的话 `audio` / `answer-box` / `shadow-dom` / `textParse*` 会静默退化成 `paragraph`。
解析阶段的警告（未识别标签、丢内容）显示在底部一行，不会被后续的渲染冲掉。
页面还按上文「修上游 `elemToHtml` 的缺陷」覆盖了 `shadow-dom` 的序列化，
否则样张里的 `shadow-dom` 样式会变成 `[object Object]`。

> 预览里的 `audio`/`answer-box`/`proxyBrowser`/`shadow-dom` 是用几行 CSS 占位显示的，
> 不是真的播放器/答题框 —— 测试页不引入他们的 `renderElems`（那会连带 `snabbdom`/`vue`
> 和自定义元素）。`textParse*` 的字体、字号、底纹则是照 `editor-v3/config.ts` 抄的，
> 预览效果和前端一致。


### 后端链路演示

```bash
pnpm demo:backend                       # 内置示例
node scripts/demo-backend.ts --editor-v3 # editor-v3 真实产物（含自定义节点）
node scripts/demo-backend.ts x.html      # 自己的 HTML
```

打印 HTML → Slate JSON → 后端改写（改文本 + 调自定义节点属性）→ HTML 的完整过程，
用的是 `internal` 引擎。只要 `dist/editor-v3-modules.mjs` 存在就会自动注册自定义模块。

---

## 已知限制

- `internal` 引擎依赖 wangEditor bundle 里两个函数的签名（已在 `6.5.0` 与 `6.6.2` 上验证）；
  换版本后如果匹配不上，会自动回退到 `public` 并发 `FALLBACK_ENGINE` 警告（附带具体原因），
  不会静默出错。升级后跑一次 `pnpm check`。
- patch 出来的副本落在 `os.tmpdir()/editor-transform/`，需要可写；不可写时同样回退。
- `require(esm)` 需要 Node ≥ 22.12（本包在 Node 24 上验证）。
- 主入口 `editor-transform` 会往全局注册 jsdom（wangEditor 在模块求值时就要 `document`），
  这是使用 wangEditor 的固有代价；浏览器或已有 DOM 的场景用 `editor-transform/browser`。
- `public` 引擎在 Node 上会泄漏内存，不要用在常驻进程里。
- 空 HTML 往返是 `<p><br></p>`（wangEditor 自己也会这么渲染），不是空字符串。
- 自定义节点不注册模块时**不会报 `CONTENT_LOSS`**（外层 `div` 让文字活了下来），只有
  `UNKNOWN_TAG`。所以后端必须把 `registerModule` 当作启动时的固定动作，而不是可选项。
- `scripts/sync-editor-v3.ts` 打包的是**当前**前端源码快照。前端改了节点的 parse/toHtml 后，
  要重新 `pnpm sync:editor-v3`，否则前后端规则会不一致。
