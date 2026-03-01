import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getChildren } from './paths'
import type { ChildEntry } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChunkStatus = 'unloaded' | 'loading' | 'loaded' | 'error'

type ChunkData = {
  status: ChunkStatus
  paths: string[]
  error?: string
}

export type PathsContextValue = {
  rootDirs: string[]
  /** Get children of a path prefix. Returns [] while a chunk is loading. */
  getChildrenCached: (prefix: string) => ChildEntry[]
  /** Chunk loading status for a root-level directory name. */
  getChunkStatus: (rootDir: string) => ChunkStatus
  /** Paths array for a loaded chunk (empty until loaded). */
  getChunkPaths: (rootDir: string) => string[]
  /** Request a chunk to be fetched (no-op if already in flight or loaded). */
  requestChunk: (rootDir: string) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const noop = () => {}

export const PathsContext = createContext<PathsContextValue>({
  rootDirs: [],
  getChildrenCached: () => [],
  getChunkStatus: () => 'unloaded',
  getChunkPaths: () => [],
  requestChunk: noop,
})

export function usePathsContext() {
  return useContext(PathsContext)
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Creates the complete context value that manages per-root-dir chunk loading.
 * Call in App and spread into <PathsContext.Provider value={…}>.
 * The returned object also exposes getChunkStatus / getChunkPaths / requestChunk
 * directly so App can use them without going through context.
 */
export function useChunksManager(
  rootDirs: string[],
  baseUrl: string,
): PathsContextValue {
  // Map root-dir name → chunk data
  const [chunkMap, setChunkMap] = useState<Map<string, ChunkData>>(() => {
    const m = new Map<string, ChunkData>()
    for (const d of rootDirs) m.set(d, { status: 'unloaded', paths: [] })
    return m
  })

  // Track in-flight requests to prevent duplicate fetches
  const inFlightRef = useRef(new Set<string>())
  // Keep a ref to chunkMap for callbacks that must not stale-close over it
  const chunkMapRef = useRef(chunkMap)
  chunkMapRef.current = chunkMap

  // Cache of getChildren results; cleared when any chunk loads
  const childrenCacheRef = useRef(new Map<string, ChildEntry[]>())

  // ── requestChunk ────────────────────────────────────────────────────────────
  const requestChunk = useCallback(
    (rootDir: string) => {
      if (inFlightRef.current.has(rootDir)) return
      const current = chunkMapRef.current.get(rootDir)
      if (current && current.status !== 'unloaded') return

      inFlightRef.current.add(rootDir)
      setChunkMap((prev) =>
        new Map(prev).set(rootDir, { status: 'loading', paths: [] }),
      )

      fetch(`${baseUrl}chunks/${rootDir}.txt`)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.text()
        })
        .then((text) => {
          const paths = text.trim() ? text.trim().split('\n') : []
          childrenCacheRef.current.clear()
          inFlightRef.current.delete(rootDir)
          setChunkMap((prev) =>
            new Map(prev).set(rootDir, { status: 'loaded', paths }),
          )
        })
        .catch((e: unknown) => {
          inFlightRef.current.delete(rootDir)
          setChunkMap((prev) =>
            new Map(prev).set(rootDir, {
              status: 'error',
              paths: [],
              error: String(e),
            }),
          )
        })
    },
    [baseUrl],
  )

  // ── getChunkStatus ───────────────────────────────────────────────────────────
  const getChunkStatus = useCallback(
    (rootDir: string): ChunkStatus =>
      chunkMap.get(rootDir)?.status ?? 'unloaded',
    [chunkMap],
  )

  // ── getChunkPaths ────────────────────────────────────────────────────────────
  const getChunkPaths = useCallback(
    (rootDir: string): string[] => chunkMap.get(rootDir)?.paths ?? [],
    [chunkMap],
  )

  // ── getChildrenCached ────────────────────────────────────────────────────────
  const getChildrenCached = useCallback(
    (prefix: string): ChildEntry[] => {
      // Root level: no chunk needed — rootDirs are always known from meta
      if (prefix === '') {
        return rootDirs.map((name) => ({
          name,
          isDir: true,
          path: '/' + name,
        }))
      }

      const cached = childrenCacheRef.current.get(prefix)
      if (cached) return cached

      const rootDir = prefix.split('/')[1] ?? ''
      const chunk = chunkMap.get(rootDir)
      if (!chunk || chunk.status !== 'loaded') return []

      const result = getChildren(chunk.paths, prefix)
      childrenCacheRef.current.set(prefix, result)
      return result
    },
    [chunkMap, rootDirs],
  )

  // ── Context value ────────────────────────────────────────────────────────────
  return useMemo(
    () => ({
      rootDirs,
      getChildrenCached,
      getChunkStatus,
      getChunkPaths,
      requestChunk,
    }),
    [rootDirs, getChildrenCached, getChunkStatus, getChunkPaths, requestChunk],
  )
}
