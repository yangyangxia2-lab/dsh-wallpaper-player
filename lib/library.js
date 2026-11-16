/**
 * Wallpaper Engine project scanner for dsh-wallpaper-player.
 *
 * Reads `project.json` files from the installation's own project folders and
 * from every subscribed Workshop folder, and keeps a small in-memory catalog
 * so the HTTP routes can resolve an opaque id back to a file without ever
 * trusting a client-supplied path.
 *
 * Only metadata reads: project.json, preview images, and the media file.
 */

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { discoverWallpaperEngine } from './steam.js'

export const ROUTE_PREFIX = '/wallpaper-player'

const VIDEO_TYPES = new Map([
  ['.mp4', 'video/mp4'],
  ['.m4v', 'video/x-m4v'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.ogv', 'video/ogg'],
])

const IMAGE_TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.bmp', 'image/bmp'],
])

const PREVIEW_CANDIDATES = ['preview.jpg', 'preview.jpeg', 'preview.png', 'preview.gif', 'preview.webp']

function isDir(p) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return statSync(p).isFile()
  } catch {
    return false
  }
}

function inside(base, candidate) {
  const relative = path.relative(base, candidate)
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
}

function resolveInside(base, value) {
  if (typeof value !== 'string' || value.trim() === '') return null
  const absolute = path.resolve(base, value.trim())
  if (!inside(base, absolute) || !isFile(absolute)) return null
  return absolute
}

function readJson(file) {
  try {
    const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
    return JSON.parse(text)
  } catch {
    return null
  }
}

function findPreview(dir, declared) {
  const candidates = []
  if (typeof declared === 'string' && declared.trim() !== '') {
    const resolved = resolveInside(dir, declared)
    if (resolved !== null) return resolved
    candidates.push(declared.trim())
  }
  for (const name of PREVIEW_CANDIDATES) candidates.push(name)
  for (const name of candidates) {
    const resolved = resolveInside(dir, name)
    if (resolved !== null) return resolved
  }
  return null
}

function cleanTitle(value, fallback) {
  if (typeof value !== 'string') return fallback
  const title = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (title === '') return fallback
  return title.slice(0, 300)
}

/**
 * @typedef {object} WallpaperItem
 * @property {string} id            Opaque catalog id used in URLs.
 * @property {string} title
 * @property {'video'|'scene'|'web'|'image'} kind
 * @property {boolean} playable     True when mediaUrl streams directly.
 * @property {string|null} previewUrl
 * @property {string|null} mediaUrl
 * @property {string|null} mediaType
 * @property {string[]} tags
 * @property {string|null} contentRating
 */

function readProject(dir) {
  if (!isDir(dir)) return null
  const projectFile = path.join(dir, 'project.json')
  if (!isFile(projectFile)) return null
  const project = readJson(projectFile)
  if (project === null || typeof project !== 'object' || Array.isArray(project)) return null

  const folderTitle = path.basename(dir)
  const title = cleanTitle(project.title, folderTitle)

  const mediaFile = resolveInside(dir, project.file)
  const mediaExt = mediaFile === null ? '' : path.extname(mediaFile).toLowerCase()
  const videoType = VIDEO_TYPES.get(mediaExt) ?? null
  const imageType = IMAGE_TYPES.get(mediaExt) ?? null

  const declared = typeof project.type === 'string' ? project.type.trim().toLowerCase() : ''
  let kind = declared
  if (kind !== 'video' && kind !== 'scene' && kind !== 'web' && kind !== 'image') {
    if (videoType !== null) kind = 'video'
    else if (imageType !== null) kind = 'image'
    else if (isFile(path.join(dir, 'scene.pkg')) || isFile(path.join(dir, 'scene.json'))) kind = 'scene'
    else if (isFile(path.join(dir, 'index.html'))) kind = 'web'
    else if (isFile(path.join(dir, 'scene.pkg'))) kind = 'scene'
    else kind = 'scene'
  }

  if (kind === 'application') return null

  const preview = findPreview(dir, project.preview)
  const id = createHash('sha1').update(dir.toLowerCase()).digest('hex').slice(0, 12)

  let streamFile = null
  let streamType = null
  if (kind === 'video' && mediaFile !== null && videoType !== null) {
    streamFile = mediaFile
    streamType = videoType
  } else if (kind === 'image' && mediaFile !== null && imageType !== null) {
    streamFile = mediaFile
    streamType = imageType
  }

  const tags = Array.isArray(project.tags)
    ? project.tags.filter((tag) => typeof tag === 'string').slice(0, 12)
    : []
  const contentRating =
    typeof project.contentrating === 'string' && project.contentrating.trim() !== ''
      ? project.contentrating.trim()
      : null

  /** @type {WallpaperItem} */
  const item = {
    id,
    title,
    kind,
    playable: streamFile !== null,
    previewUrl: preview === null ? null : `${ROUTE_PREFIX}/preview/${id}`,
    mediaUrl: streamFile === null ? null : `${ROUTE_PREFIX}/media/${id}`,
    mediaType: streamType,
    tags,
    contentRating,
  }

  return {
    item,
    entry: { id, dir, file: streamFile, preview, mediaType: streamType, kind, title },
  }
}

/**
 * @param {{ installDir?: string, libraryDirs?: string[] }} [rawConfig]
 */
export function createLibrary(rawConfig = {}) {
  const config = rawConfig !== null && typeof rawConfig === 'object' ? rawConfig : {}
  const extraRoots = []
  if (typeof config.installDir === 'string' && config.installDir.trim() !== '') {
    extraRoots.push(path.resolve(config.installDir.trim()))
  }
  if (Array.isArray(config.libraryDirs)) {
    for (const dir of config.libraryDirs) {
      if (typeof dir === 'string' && dir.trim() !== '') extraRoots.push(path.resolve(dir.trim()))
    }
  }

  /** @type {Map<string, ReturnType<typeof readProject>['entry']>} */
  const catalog = new Map()
  let cache = null
  let cacheAt = 0

  function dedupePaths(paths) {
    const seen = new Set()
    const out = []
    for (const p of paths) {
      const key = p.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(p)
    }
    return out
  }

  function rootsFor(installDir, workshopDirs) {
    const roots = []
    if (installDir !== null) {
      roots.push(path.join(installDir, 'projects', 'defaultprojects'))
      roots.push(path.join(installDir, 'projects', 'myprojects'))
    }
    for (const dir of workshopDirs) roots.push(dir)
    for (const dir of extraRoots) roots.push(dir)
    return dedupePaths(roots).filter((dir) => isDir(dir))
  }

  function scanProjects(root) {
    const projects = []
    if (isFile(path.join(root, 'project.json'))) projects.push(root)
    let entries = []
    try {
      entries = readdirSync(root, { withFileTypes: true })
    } catch {
      return projects
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dir = path.join(root, entry.name)
      if (isFile(path.join(dir, 'project.json'))) projects.push(dir)
    }
    return projects
  }

  function build() {
    const discovery = discoverWallpaperEngine()
    const installs = dedupePaths([...extraRoots.filter((dir) => isFile(path.join(dir, 'wallpaper32.exe')) || isFile(path.join(dir, 'wallpaper64.exe')) || isDir(path.join(dir, 'projects'))), ...discovery.installs])
    const installDir = installs[0] ?? null

    const workshopDirs = new Set(discovery.workshopDirs)
    for (const install of installs) {
      const idx = install.toLowerCase().indexOf('\\steamapps\\')
      if (idx > 0) {
        const dir = path.join(install.slice(0, idx), 'steamapps', 'workshop', 'content', '431960')
        if (isDir(dir)) workshopDirs.add(dir)
      }
    }

    catalog.clear()
    const items = []
    const seenProjects = new Set()
    for (const root of rootsFor(installDir, workshopDirs)) {
      for (const dir of scanProjects(root)) {
        const key = dir.toLowerCase()
        if (seenProjects.has(key)) continue
        seenProjects.add(key)
        const project = readProject(dir)
        if (project === null) continue
        if (catalog.has(project.entry.id)) continue
        catalog.set(project.entry.id, project.entry)
        items.push(project.item)
      }
    }

    items.sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN'))

    const videos = items.filter((item) => item.playable && item.kind === 'video').length
    const scenes = items.filter((item) => item.kind === 'scene').length

    return {
      ok: true,
      installDir,
      installs,
      libraryCount: workshopDirs.size,
      scannedAt: new Date().toISOString(),
      count: items.length,
      videos,
      scenes,
      items,
    }
  }

  return {
    /** Scan with a short cache so opening the page does not re-walk every folder. */
    scan(force = false) {
      const now = Date.now()
      if (!force && cache !== null && now - cacheAt < 5000) return cache
      cache = build()
      cacheAt = now
      return cache
    },
    /** @param {string} id */
    find(id) {
      if (cache === null) this.scan()
      return catalog.get(id) ?? null
    },
    invalidate() {
      cache = null
      cacheAt = 0
    },
  }
}

export function contentTypeFor(file) {
  if (typeof file !== 'string') return 'application/octet-stream'
  const ext = path.extname(file).toLowerCase()
  return VIDEO_TYPES.get(ext) ?? IMAGE_TYPES.get(ext) ?? 'application/octet-stream'
}
