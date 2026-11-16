/**
 * DOM helpers. Every function here needs a `document`; in Node the entry point
 * `editor-transform` registers jsdom globally before anything else is imported.
 */

/** Thrown when the SDK runs without a DOM and without the Node entry point. */
function requireDocument(): Document {
  if (typeof document === 'undefined') {
    throw new Error(
      'No DOM available. In Node.js import the package entry "editor-transform" ' +
        '(it registers jsdom), not the browser entry.',
    )
  }
  return document
}

/** Elements whose own text is intentionally never part of the document. */
const NON_CONTENT_TAGS = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'meta', 'link'])

/**
 * Tags whose content survives wangEditor-next's parser.
 *
 * Measured against 6.6.2 with `<p>a<TAG>X</TAG>b</p>` probes. Two groups:
 * the ones wangEditor gives a real node type (`strong`, `header1`, `table`,
 * `image`, ...), and the ones it silently unwraps while keeping the text
 * (`section`, `dl`, `address`, `center`, ...). Everything absent from this set
 * - `mark`, `ins`, `del`, `kbd`, `small`, `abbr`, `cite`, `q`, `var`, `audio`,
 * `svg`, `canvas`, ... - is discarded *together with its text*, which is the
 * one failure mode a backend must never miss.
 */
export const DEFAULT_ALLOWED_TAGS: ReadonlySet<string> = new Set([
  // structural wrappers (unwrapped, content preserved)
  'html', 'body', 'div', 'section', 'article', 'aside', 'header', 'footer', 'main', 'nav',
  'figure', 'figcaption', 'address', 'center', 'details', 'summary', 'dl', 'dt', 'dd',
  'fieldset', 'form', 'legend', 'label',
  // text blocks
  'p', 'br', 'hr', 'span', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'pre', 'blockquote', 'ul', 'ol', 'li',
  // inline marks with a Slate equivalent
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'code',
  // links and media
  'a', 'img', 'video', 'iframe', 'source',
  // tables
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'colgroup', 'col',
])

function parseFragment(html: string): HTMLElement {
  const root = requireDocument().createElement('div')
  root.innerHTML = html
  return root
}

/**
 * Visible text of an HTML string, with scripts, styles and templates removed.
 * Entities are decoded by the HTML parser (`&amp;` becomes `&`), which matches
 * what wangEditor stores in Slate.
 */
export function htmlToText(html: string): string {
  const root = parseFragment(html)
  for (const node of Array.from(root.querySelectorAll([...NON_CONTENT_TAGS].join(',')))) {
    node.remove()
  }
  return root.textContent ?? ''
}

/**
 * Collapse whitespace-only runs between adjacent tags when they span a newline.
 *
 * Pretty-printed HTML such as
 *
 *     <h1>t</h1>\n  <p>b</p>
 *
 * makes wangEditor emit an extra empty paragraph (and even a `{"text":"  "}`
 * paragraph) for the gap. Real `getHtml()` output is compact, so this only
 * affects hand-written or pretty-printed input.
 *
 * `<pre>` / `<textarea>` contents are left untouched, and inline spacing that
 * does not span a newline (`<strong>a</strong> <em>b</em>`) is preserved.
 */
export function normalizeHtml(html: string): string {
  const preserve = /<pre\b[\s\S]*?<\/pre>|<textarea\b[\s\S]*?<\/textarea>/gi
  const collapse = (chunk: string): string => chunk.replace(/>\s*\n\s*</g, '><')

  let out = ''
  let last = 0
  for (const match of html.matchAll(preserve)) {
    const index = match.index ?? 0
    out += collapse(html.slice(last, index)) + match[0]
    last = index + match[0].length
  }
  out += collapse(html.slice(last))
  return out.trim()
}

/** Every lower-cased tag name used in the document. */
export function collectTagNames(html: string): Set<string> {
  const root = parseFragment(html)
  const tags = new Set<string>()
  for (const el of Array.from(root.querySelectorAll('*'))) tags.add(el.tagName.toLowerCase())
  return tags
}

/**
 * Tags used in the document that no rule accounts for, in document order.
 *
 * `handled` exists because custom modules legitimately emit elements the
 * default list knows nothing about (`<answer-box>`, `<cp-audio-player>`,
 * `<proxy-browser>` in a real project). A tag that the serializer reproduces
 * round-trip is, by definition, understood - so passing the tag names of the
 * rendered output silences exactly the false alarms and keeps the real ones:
 * a tag that does *not* come back is one whose content wangEditor threw away.
 */
export function collectUnknownTags(
  html: string,
  allowed: ReadonlySet<string> = DEFAULT_ALLOWED_TAGS,
  handled: ReadonlySet<string> = new Set(),
): string[] {
  const root = parseFragment(html)
  const unknown: string[] = []
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const tag = el.tagName.toLowerCase()
    if (NON_CONTENT_TAGS.has(tag) || allowed.has(tag) || handled.has(tag)) continue
    if (!unknown.includes(tag)) unknown.push(tag)
  }
  return unknown
}

/** `DEFAULT_ALLOWED_TAGS` plus any caller-supplied extra names. */
export function resolveAllowedTags(extra?: readonly string[]): ReadonlySet<string> {
  if (!extra || extra.length === 0) return DEFAULT_ALLOWED_TAGS
  const merged = new Set(DEFAULT_ALLOWED_TAGS)
  for (const tag of extra) merged.add(tag.trim().toLowerCase())
  return merged
}
