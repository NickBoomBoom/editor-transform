import { createServer } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Static server for the test page in `demo/`.
 *
 * It intentionally serves the repository root, so the import map in the page
 * can point straight at `node_modules/@wangeditor-next/editor/dist/index.mjs`.
 * Run `npm run demo` to build the browser bundle first.
 */

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const port = Number(process.env.PORT ?? 6754)

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
}

const BUNDLE = path.join(root, 'dist', 'browser.js')

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://localhost:${port}`)
  const relative = decodeURIComponent(pathname === '/' ? '/demo/index.html' : pathname)
  const file = path.join(root, relative)

  // Never serve anything outside the repository.
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
    response.end('403 forbidden')
    return
  }

  fs.readFile(file, (error, data) => {
    if (error) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(`404 not found: ${relative}`)
      return
    }
    const type = CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream'
    response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
    response.end(data)
  })
})

server.listen(port, () => {
  const ready = fs.existsSync(BUNDLE) ? '' : '  (dist/browser.js missing - run `npm run build` first)'
  console.log(`editor-transform demo  ->  http://localhost:${port}/${ready}`)
})
