/**
 * Workarounds for defects in the modules they patch.
 *
 * These are plain wangEditor modules, so they can be installed by hand with
 * `registerModule(...)` - which is what the README used to ask for - and they are
 * also part of the set the Node entry point installs automatically (see
 * `src/builtin-modules.ts`).
 */

/**
 * Repairs editor-v3's `shadow-dom` serializer.
 *
 * Two defects make the bundled rule lossy:
 *
 * 1. `parse-elem-html.ts` keeps `style` as an *object* (`styleStringToObject`),
 *    while `elem-to-html.ts` interpolates the raw value, so every style comes
 *    back as `style="[object Object]"`;
 * 2. the attributes are concatenated without a separator, so `class="a"id="b"`
 *    is emitted.
 *
 * wangEditor stores serializers as `type → elemToHtml` in a registry where the
 * last registration wins, so registering this rule *after* the bundled modules
 * overrides it without touching editor-v3's repository.
 */
export const shadowDomSerializerRepair = {
  elemsToHtml: [
    {
      type: 'shadow-dom',
      elemToHtml(elem: Record<string, unknown>) {
        const doms = Array.isArray(elem.doms) ? (elem.doms as Record<string, unknown>[]) : []
        const inner = doms
          .map((dom) => {
            const tag = String(dom.tag ?? 'span')
            const attrs = Object.entries((dom.attrs ?? {}) as Record<string, unknown>)
              .map(([key, raw]) => {
                const value =
                  raw && typeof raw === 'object'
                    ? Object.entries(raw as Record<string, unknown>)
                        .map(([p, v]) => `${p}: ${v}`)
                        .join('; ')
                    : String(raw)
                return ` ${key}="${value}"`
              })
              .join('')
            return `<${tag}${attrs}>${String(dom.html ?? '')}</${tag}>`
          })
          .join('')
        return `<div data-w-e-type="shadow-dom">${inner}</div>`
      },
    },
  ],
}
