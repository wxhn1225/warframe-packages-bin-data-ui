import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useDeferredValue,
} from 'react'
import { Loader2, AlertCircle, GitCommit, Database, Clock } from 'lucide-react'
import type { TreeMeta } from './types'
import { navigatePath } from './lib/paths'
import { PathsContext, useChunksManager } from './lib/PathsContext'
import { formatNumber, formatDate } from './lib/utils'
import TreePanel from './components/TreePanel'
import DetailPanel from './components/DetailPanel'

export default function App() {
  const [meta, setMeta] = useState<TreeMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const deferredQuery = useDeferredValue(searchQuery)

  const focusSearchRef = useRef<HTMLInputElement | null>(null)

  const BASE_URL = import.meta.env.BASE_URL

  // ── Load meta only — tree-meta.json is tiny, instant ────────────────────────
  useEffect(() => {
    const ac = new AbortController()

    fetch(BASE_URL + 'tree-meta.json', { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<TreeMeta>
      })
      .then(setMeta)
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))

    return () => ac.abort()
  }, [BASE_URL])

  // ── Chunk manager — lazy loads per-root-dir data ──────────────────────────
  const chunksCtx = useChunksManager(meta?.root_dirs ?? [], BASE_URL)
  const { getChunkStatus, getChunkPaths, requestChunk } = chunksCtx

  // ── Search → path navigation ─────────────────────────────────────────────
  useEffect(() => {
    if (!meta) return

    const query = deferredQuery.trim()
    if (!query) {
      setExpandedPaths(new Set())
      setScrollTarget(null)
      return
    }

    const normalized = query.startsWith('/') ? query : '/' + query
    const rootDir = normalized.split('/')[1] ?? ''

    if (!rootDir) return

    const status = getChunkStatus(rootDir)

    if (status === 'unloaded') {
      requestChunk(rootDir)
      return // effect will re-run when chunk status changes
    }

    if (status === 'loading') return // wait for it

    if (status === 'error') return

    // Chunk is loaded → navigate
    const chunkPaths = getChunkPaths(rootDir)
    const result = navigatePath(chunkPaths, query)

    setExpandedPaths(new Set(result.expandPaths))
    setScrollTarget(result.targetPath || null)

    if (result.isTargetFile) {
      setSelectedPath(result.targetPath)
    }
  }, [deferredQuery, meta, getChunkStatus, getChunkPaths, requestChunk])

  // ── Auto-scroll to target after tree renders ─────────────────────────────
  useEffect(() => {
    if (!scrollTarget) return
    const id = requestAnimationFrame(() => {
      const el = document.querySelector(`[data-path="${scrollTarget}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    return () => cancelAnimationFrame(id)
  }, [scrollTarget, expandedPaths])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        focusSearchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchQuery('')
        focusSearchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleToggle = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleSelect = useCallback((path: string) => {
    setSelectedPath(path)
  }, [])

  const handleSearchChange = useCallback((q: string) => {
    setSearchQuery(q)
  }, [])

  const handleSearchClear = useCallback(() => {
    setSearchQuery('')
  }, [])

  // ── Render: loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--color-text-dim)]">
        <Loader2 size={32} className="animate-spin text-[var(--color-brand)]" />
        <p className="text-sm">加载元数据...</p>
      </div>
    )
  }

  // ── Render: error ────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-lg border border-red-900/50 bg-red-950/20 p-6">
          <div className="mb-3 flex items-center gap-2 text-red-400">
            <AlertCircle size={18} />
            <span className="font-semibold">加载失败</span>
          </div>
          <p className="text-sm text-red-300/80">{error}</p>
          <p className="mt-3 text-xs text-[var(--color-text-dim)]">
            请先运行{' '}
            <code className="text-[var(--color-brand)]">npm run generate</code>{' '}
            生成数据
          </p>
        </div>
      </div>
    )
  }

  if (!meta) return null

  // ── Render: main ─────────────────────────────────────────────────────────
  return (
    <PathsContext.Provider value={chunksCtx}>
      <div className="flex h-full flex-col overflow-hidden bg-[var(--color-surface-base)]">
        {/* Header */}
        <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-2.5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[var(--color-brand)] text-lg">⬡</span>
                <h1 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Warframe Packages Browser
                </h1>
              </div>
              <span className="hidden h-4 w-px bg-[var(--color-border)] sm:block" />
              <div className="hidden items-center gap-1.5 text-xs text-[var(--color-text-dim)] sm:flex">
                <Database size={12} />
                <span>{formatNumber(meta.total_files)} 个文件</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[var(--color-text-dim)]">
              <div className="hidden items-center gap-1.5 md:flex">
                <GitCommit size={12} />
                <a
                  href={`${meta.submodule_url}/commit/${meta.submodule_commit}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono hover:text-[var(--color-brand)] transition-colors"
                  title={meta.submodule_commit_message}
                >
                  {meta.submodule_commit.slice(0, 7)}
                </a>
                <span
                  className="max-w-[200px] truncate opacity-70"
                  title={meta.submodule_commit_message}
                >
                  {meta.submodule_commit_message}
                </span>
              </div>
              <div className="hidden items-center gap-1 lg:flex">
                <Clock size={12} />
                <span>{formatDate(meta.generated_at)}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: file tree */}
          <div className="w-72 shrink-0 overflow-hidden lg:w-80 xl:w-96">
            <TreePanel
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              scrollTarget={scrollTarget}
              searchQuery={searchQuery}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onSearchChange={handleSearchChange}
              onSearchClear={handleSearchClear}
              focusSearchRef={focusSearchRef}
            />
          </div>

          {/* Right: detail */}
          <div className="flex-1 overflow-hidden">
            <DetailPanel
              selectedPath={selectedPath}
              submoduleUrl={meta.submodule_url}
              submoduleCommit={meta.submodule_commit}
            />
          </div>
        </div>

        {/* Status bar */}
        <footer className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-1">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-dim)]">
            <span>
              {selectedPath ? (
                <span className="font-mono text-[var(--color-text-muted)]">
                  {selectedPath}
                </span>
              ) : (
                '选择文件以查看详情 · Ctrl+K 聚焦搜索'
              )}
            </span>
            <a
              href={meta.submodule_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden hover:text-[var(--color-brand)] transition-colors sm:block"
            >
              Sainan/warframe-packages-bin-data
            </a>
          </div>
        </footer>
      </div>
    </PathsContext.Provider>
  )
}
