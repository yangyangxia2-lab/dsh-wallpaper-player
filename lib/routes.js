/**
 * HTTP routes for dsh-wallpaper-player.
 *
 * All paths sit under ROUTE_PREFIX; the host plugin registers one prefix
 * route. Ids come from the scanner catalog, so the client can never ask for
 * an arbitrary filesystem path.
 *
 *   GET  /wallpaper-player/library        JSON catalog (search / kind filters)
 *   GET  /wallpaper-player/preview/:id    project preview image
 *   GET  /wallpaper-player/media/:id      video/image stream (HTTP Range)
 */

import { createReadStream, statSync } from 'node:fs'
import { contentTypeFor, ROUTE_PREFIX } from './library.js'

const PREFIX = ROUTE_PREFIX

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
}

const IMAGE_HEADERS = {
  'Cache-Control': 'private, max-age=86400',
  'X-Content-Type-Options': 'nosniff',
}

function sendJson(res, status, payload) {
  const text = JSON.stringify(payload)
  res.writeHead(status, { ...JSON_HEADERS, 'Content-Length': Buffer.byteLength(text) })
  res.end(text)
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': Buffer.byteLength(text), ...headers })
  res.end(text)
}

function etagFor(stat) {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`
}

function notModified(req, etag) {
  const header = req.headers['if-none-match']
  return typeof header === 'string' && header.split(',').some((value) => value.trim() === etag)
}

/**
 * @param {string} header
 * @param {number} size
 * @returns {{ start: number, end: number } | { invalid: true } | null}
 */
function parseRange(header, size) {
  if (typeof header !== 'string' || header.trim() === '') return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (match === null) return { invalid: true }
  const [, rawStart, rawEnd] = match
  if (rawStart === '' && rawEnd === '') return { invalid: true }

  let start
  let end
  if (rawStart === '') {
    const suffix = Number(rawEnd)
    if (!Number.isInteger(suffix) || suffix <= 0) return { invalid: true }
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number(rawStart)
    end = rawEnd === '' ? size - 1 : Number(rawEnd)
  }
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || start >= size || end < start) {
    return { invalid: true }
  }
  return { start, end: Math.min(end, size - 1) }
}

function streamFile(req, res, file, headers) {
  let stat
  try {
    stat = statSync(file)
  } catch {
    sendText(res, 404, 'Not found')
    return
  }
  if (!stat.isFile()) {
    sendText(res, 404, 'Not found')
    return
  }

  const baseHeaders = {
    ...headers,
    'Accept-Ranges': 'bytes',
    'Content-Type': headers['Content-Type'] ?? 'application/octet-stream',
    'Last-Modified': stat.mtime.toUTCString(),
  }

  const range = parseRange(req.headers.range, stat.size)
  if (range !== null && 'invalid' in range) {
    res.writeHead(416, { ...baseHeaders, 'Content-Range': `bytes */${stat.size}`, 'Content-Length': '0' })
    res.end()
    return
  }

  const start = range === null ? 0 : range.start
  const end = range === null ? stat.size - 1 : range.end
  if (stat.size === 0) {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': '0' })
    res.end()
    return
  }

  const status = range === null ? 200 : 206
  const responseHeaders = {
    ...baseHeaders,
    'Content-Length': String(end - start + 1),
  }
  if (range !== null) responseHeaders['Content-Range'] = `bytes ${start}-${end}/${stat.size}`

  if (req.method === 'HEAD') {
    res.writeHead(status, responseHeaders)
    res.end()
    return
  }

  res.writeHead(status, responseHeaders)
  const stream = createReadStream(file, { start, end })
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

function sendImage(req, res, file) {
  let stat
  try {
    stat = statSync(file)
  } catch {
    sendText(res, 404, 'Not found')
    return
  }
  const etag = etagFor(stat)
  const headers = {
    ...IMAGE_HEADERS,
    'Content-Type': contentTypeFor(file),
    'Content-Length': String(stat.size),
    ETag: etag,
    'Last-Modified': stat.mtime.toUTCString(),
  }
  if (notModified(req, etag)) {
    res.writeHead(304, { ETag: etag, 'Cache-Control': IMAGE_HEADERS['Cache-Control'] })
    res.end()
    return
  }
  if (req.method === 'HEAD') {
    res.writeHead(200, headers)
    res.end()
    return
  }
  res.writeHead(200, headers)
  const stream = createReadStream(file)
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

function matchId(pathname) {
  if (pathname.startsWith(`${PREFIX}/preview/`)) {
    return { kind: 'preview', id: pathname.slice(`${PREFIX}/preview/`.length) }
  }
  if (pathname.startsWith(`${PREFIX}/media/`)) {
    return { kind: 'media', id: pathname.slice(`${PREFIX}/media/`.length) }
  }
  return null
}

/**
 * @param {{ scan: Function, find: Function, invalidate: Function }} library
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>}
 */
export function createRoutes(library) {
  return async function handle(req, res) {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        sendText(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' })
        return
      }

      const url = new URL(req.url ?? '/', 'http://localhost')
      const pathname = url.pathname

      if (pathname === PREFIX || pathname === `${PREFIX}/`) {
        res.writeHead(302, { Location: `${PREFIX}/library` })
        res.end()
        return
      }

      const target = matchId(pathname)
      if (target !== null) {
        const id = decodeURIComponent(target.id)
        const entry = library.find(id)
        if (entry === null) {
          sendJson(res, 404, { ok: false, error: 'Unknown wallpaper id' })
          return
        }
        if (target.kind === 'preview') {
          if (entry.preview === null) {
            sendJson(res, 404, { ok: false, error: 'No preview for this wallpaper' })
            return
          }
          sendImage(req, res, entry.preview)
          return
        }
        if (entry.file === null) {
          sendJson(res, 404, { ok: false, error: 'This wallpaper is not streamable here' })
          return
        }
        streamFile(req, res, entry.file, { 'Content-Type': entry.mediaType ?? 'application/octet-stream' })
        return
      }

      if (pathname === `${PREFIX}/library`) {
        const force = url.searchParams.get('refresh') === '1'
        const snapshot = library.scan(force)
        const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
        const kind = (url.searchParams.get('kind') ?? '').trim().toLowerCase()

        let items = snapshot.items
        if (kind !== '' && kind !== 'all') items = items.filter((item) => item.kind === kind)
        if (query !== '') {
          items = items.filter(
            (item) => item.title.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query)),
          )
        }

        sendJson(res, 200, {
          ok: true,
          installDir: snapshot.installDir,
          installs: snapshot.installs,
          libraryCount: snapshot.libraryCount,
          scannedAt: snapshot.scannedAt,
          count: items.length,
          total: snapshot.count,
          videos: snapshot.videos,
          scenes: snapshot.scenes,
          items,
        })
        return
      }

      sendJson(res, 404, { ok: false, error: 'Not found' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!res.headersSent) {
        sendJson(res, 500, { ok: false, error: message })
      } else {
        res.destroy()
      }
    }
  }
}
