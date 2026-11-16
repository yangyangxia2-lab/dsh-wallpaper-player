/**
 * Locate a local Wallpaper Engine installation and its Workshop content.
 *
 * Wallpaper Engine is Steam app 431960. Its projects live in
 * `<install>/projects/{defaultprojects,myprojects}`, and subscribed Workshop
 * items live in `<library>/steamapps/workshop/content/431960`. The two can sit
 * in different Steam libraries, so discovery returns every candidate it proves.
 *
 * Pure reads only: no writes, no process spawning beyond `reg query`.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'

export const WE_APPID = '431960'

const INSTALL_MARKERS = [
  'wallpaper32.exe',
  'wallpaper64.exe',
  path.join('distribution', 'wallpaper32.exe'),
  path.join('distribution', 'wallpaper64.exe'),
  path.join('distribution', 'version.json'),
]

const KNOWN_STEAM_DIRS = [
  'C:\\Program Files (x86)\\Steam',
  'C:\\Program Files\\Steam',
  'D:\\Steam',
  'D:\\SteamLibrary',
  'E:\\Steam',
  'E:\\SteamLibrary',
  'F:\\Steam',
  'F:\\SteamLibrary',
]

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

function hasProjectJson(dir) {
  return isFile(path.join(dir, 'project.json'))
}

export function isWallpaperEngineInstall(dir) {
  if (typeof dir !== 'string' || dir === '') return false
  if (INSTALL_MARKERS.some((marker) => isFile(path.join(dir, marker)))) return true
  return isDir(path.join(dir, 'projects', 'defaultprojects'))
}

function normalizeDir(value) {
  if (typeof value !== 'string') return null
  let p = value.trim().replace(/^"+|"+$/g, '')
  if (p === '') return null
  p = p.replace(/\//g, '\\')
  return path.resolve(p)
}

function steamPathFromRegistry() {
  try {
    const output = execFileSync('reg', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 2500,
    })
    const match = output.match(/SteamPath\s+REG_SZ\s+(.+)/i)
    return match === null ? null : normalizeDir(match[1])
  } catch {
    return null
  }
}

function libraryPathsFromVdf(steamDir) {
  const found = []
  const vdf = path.join(steamDir, 'steamapps', 'libraryfolders.vdf')
  if (!isFile(vdf)) return found
  try {
    const text = readFileSync(vdf, 'utf8')
    for (const match of text.matchAll(/"path"\s+"([^"]+)"/g)) {
      const raw = match[1].replace(/\\\\/g, '\\')
      found.push(normalizeDir(raw))
    }
  } catch {
    // Unreadable VDF: keep whatever the caller already knows.
  }
  return found
}

/**
 * @returns {{ installs: string[], workshopDirs: string[], steamDirs: string[] }}
 *   Absolute, de-duplicated directories. `installs` have Wallpaper Engine's
 *   markers; `workshopDirs` are existing `.../workshop/content/431960` folders.
 */
export function discoverWallpaperEngine() {
  const steamDirs = new Set()
  const installs = new Set()
  const workshopDirs = new Set()

  const addSteamDir = (dir) => {
    if (dir !== null) steamDirs.add(dir)
  }

  for (const envName of ['DSH_WALLPAPER_ENGINE_DIR', 'WALLPAPER_ENGINE_DIR', 'STEAM_PATH']) {
    const value = normalizeDir(process.env[envName])
    if (value === null) continue
    if (path.basename(value) === WE_APPID) {
      workshopDirs.add(value)
      continue
    }
    if (hasProjectJson(value)) {
      // Pointed straight at a workshop item: treat its parent as the library.
      workshopDirs.add(path.dirname(value))
      continue
    }
    if (isWallpaperEngineInstall(value)) {
      installs.add(value)
      const idx = value.toLowerCase().indexOf('\\steamapps\\')
      if (idx > 0) addSteamDir(value.slice(0, idx))
      continue
    }
    addSteamDir(value)
  }

  addSteamDir(steamPathFromRegistry())
  for (const dir of KNOWN_STEAM_DIRS) addSteamDir(normalizeDir(dir))

  // Follow libraryfolders.vdf one hop out of every known Steam library.
  for (const dir of [...steamDirs]) {
    for (const library of libraryPathsFromVdf(dir)) addSteamDir(library)
  }

  for (const steamDir of steamDirs) {
    const common = path.join(steamDir, 'steamapps', 'common', 'wallpaper_engine')
    if (isWallpaperEngineInstall(common)) installs.add(common)
    const workshop = path.join(steamDir, 'steamapps', 'workshop', 'content', WE_APPID)
    if (isDir(workshop)) workshopDirs.add(workshop)
    // A Steam library path may itself be the install or hold Workshop content.
    if (isWallpaperEngineInstall(steamDir)) installs.add(steamDir)
  }

  for (const install of [...installs]) {
    const idx = install.toLowerCase().indexOf('\\steamapps\\')
    if (idx > 0) {
      const workshop = path.join(install.slice(0, idx), 'steamapps', 'workshop', 'content', WE_APPID)
      if (isDir(workshop)) workshopDirs.add(workshop)
    }
  }

  return {
    installs: [...installs],
    workshopDirs: [...workshopDirs],
    steamDirs: [...steamDirs],
  }
}

/**
 * A lightweight "is this a Wallpaper Engine project folder" probe.
 * @param {string} dir
 */
export function isProjectDir(dir) {
  return isDir(dir) && hasProjectJson(dir)
}
