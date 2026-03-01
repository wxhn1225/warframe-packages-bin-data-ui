import type { ChildEntry } from '../types'

// ── Binary search ─────────────────────────────────────────────────────────────

/** First index i where arr[i] >= target. Returns arr.length if none. */
export function lowerBound(arr: string[], target: string): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if ((arr[mid] as string) < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

// ── Virtual tree operations ───────────────────────────────────────────────────

/**
 * Get immediate children of a directory prefix.
 * prefix = ''        → root level children (/Lotus, /Configs, …)
 * prefix = '/Lotus'  → Lotus's direct children
 */
export function getChildren(paths: string[], prefix: string): ChildEntry[] {
  const slashPrefix = prefix + '/' // e.g. '/' or '/Lotus/'
  const start = lowerBound(paths, slashPrefix)

  const seen = new Map<string, boolean>() // name → isDir

  for (let i = start; i < paths.length; i++) {
    const p = paths[i] as string
    if (!p.startsWith(slashPrefix)) break

    const rest = p.slice(slashPrefix.length)
    const slash = rest.indexOf('/')

    if (slash === -1) {
      // Direct file child — only add if not already seen as dir
      if (!seen.has(rest)) seen.set(rest, false)
    } else {
      // Entry is inside a sub-directory
      const dir = rest.slice(0, slash)
      seen.set(dir, true) // mark/upgrade to directory
    }
  }

  return [...seen.entries()]
    .map(([name, isDir]) => ({ name, isDir, path: prefix + '/' + name }))
    .sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

/** True if path has any children (is a directory). */
export function isDirectory(paths: string[], path: string): boolean {
  const prefix = path + '/'
  const idx = lowerBound(paths, prefix)
  return idx < paths.length && (paths[idx] as string).startsWith(prefix)
}

/** True if path is an exact file entry. */
export function isFile(paths: string[], path: string): boolean {
  const idx = lowerBound(paths, path)
  return idx < paths.length && paths[idx] === path
}

// ── Path navigation ───────────────────────────────────────────────────────────

export type NavResult = {
  /** All directory paths that should be expanded */
  expandPaths: string[]
  /** The deepest valid path reached */
  targetPath: string
  /** Whether the target is a file (should auto-select in detail panel) */
  isTargetFile: boolean
  /** Unmatched last segment (partial input) */
  partialSegment: string
}

/**
 * Parse a search query as a path and navigate the virtual tree.
 * Returns which directories to expand and the final target.
 *
 * Examples:
 *   '/Lotus/Weapons/Tenno/Melee/MeleeTrees'          → expand all 5 dirs
 *   '/Lotus/Weapons/Tenno/Melee/MeleeTrees/SomeFile' → expand 5 dirs, select file
 *   '/Lotus/Weap'                                     → expand /Lotus, partial='Weap'
 */
export function navigatePath(paths: string[], query: string): NavResult {
  if (!query.trim()) {
    return { expandPaths: [], targetPath: '', isTargetFile: false, partialSegment: '' }
  }

  const normalized = query.startsWith('/') ? query : '/' + query
  // Strip trailing slash so '/Lotus/Weapons/' and '/Lotus/Weapons' behave the same
  const trimmed = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  const segments = trimmed.split('/').filter(Boolean)

  if (segments.length === 0) {
    return { expandPaths: [], targetPath: '', isTargetFile: false, partialSegment: '' }
  }

  const expandPaths: string[] = []
  let currentPath = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i] as string
    const next = currentPath + '/' + segment

    if (isDirectory(paths, next)) {
      expandPaths.push(next)
      currentPath = next
    } else if (i === segments.length - 1 && isFile(paths, next)) {
      // Last segment is a real file → select it
      return { expandPaths, targetPath: next, isTargetFile: true, partialSegment: '' }
    } else {
      // Path not found or is partial
      return {
        expandPaths,
        targetPath: currentPath,
        isTargetFile: false,
        partialSegment: segment,
      }
    }
  }

  return { expandPaths, targetPath: currentPath, isTargetFile: false, partialSegment: '' }
}
