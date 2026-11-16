import {
  collectTagNames,
  collectUnknownTags,
  htmlToText,
  resolveAllowedTags,
} from './dom.ts'
import type { ContentLossReport } from './types.ts'

export interface Analysis {
  report: ContentLossReport
  unknownTags: string[]
}

/**
 * The parts of `input` that `output` does not account for, in input order.
 *
 * A plain character diff would report the missing characters in whatever order
 * it happened to consume them, which reads like gibberish. Chars are counted
 * first, then re-emitted as contiguous runs of the *original* text, so a
 * dropped `<mark>高亮文字</mark>` is reported as `高亮文字` and not `亮高字文`.
 * Distant runs are joined with ` … ` to make the gap visible.
 */
export function droppedRuns(input: string, output: string): string {
  const available = new Map<string, number>()
  for (const ch of output) available.set(ch, (available.get(ch) ?? 0) + 1)

  const missing = new Map<string, number>()
  for (const ch of input) {
    const left = available.get(ch) ?? 0
    if (left > 0) available.set(ch, left - 1)
    else missing.set(ch, (missing.get(ch) ?? 0) + 1)
  }

  const runs: string[] = []
  let current = ''
  for (const ch of input) {
    const left = missing.get(ch) ?? 0
    if (left > 0) {
      missing.set(ch, left - 1)
      current += ch
    } else if (current !== '') {
      runs.push(current)
      current = ''
    }
  }
  if (current !== '') runs.push(current)
  return runs.join(' … ')
}

/** Whitespace is ignored on both sides: it is not content, and normalisation may shift it. */
const strip = (s: string): string => s.replace(/\s+/g, '')

/**
 * Compare the text of the input HTML with the text the backend can get back.
 *
 * The comparison is made against the *rendered* HTML rather than the Slate text
 * nodes, because a custom node type may legitimately keep its text outside
 * `children` - editor-v3's `shadow-dom` stores it in `doms[].html`. Measuring
 * Slate text would call that a loss and cry wolf on every custom node.
 *
 * This is the safety net for wangEditor's worst behaviour: unknown elements are
 * discarded *along with their text*, so `<p>a<mark>KEEP</mark>b</p>` silently
 * becomes `ab`.
 *
 * @param inputHtml  HTML as it came out of `editor.getHtml()`.
 * @param renderedHtml Result of rendering the parsed document back to HTML.
 * @param allowedTags Extra tags the caller vouches for (custom modules).
 */
export function analyze(
  inputHtml: string,
  renderedHtml: string,
  allowedTags?: readonly string[],
): Analysis {
  const inputText = htmlToText(inputHtml)
  const outputText = htmlToText(renderedHtml)

  return {
    report: {
      inputText,
      outputText,
      droppedText: droppedRuns(strip(inputText), strip(outputText)),
    },
    // A tag the renderer reproduces is understood, whatever it is called.
    unknownTags: collectUnknownTags(
      inputHtml,
      resolveAllowedTags(allowedTags),
      collectTagNames(renderedHtml),
    ),
  }
}
