import { memo, useCallback, useEffect, useMemo } from 'react'
import { ChevronRight, Folder, FolderOpen, FileJson, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'
import { usePathsContext } from '../lib/PathsContext'

interface TreeNodeProps {
  name: string
  path: string
  isDir: boolean
  expandedPaths: Set<string>
  selectedPath: string | null
  scrollTarget: string | null
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  depth: number
}

const TreeNode = memo(function TreeNode({
  name,
  path,
  isDir,
  expandedPaths,
  selectedPath,
  scrollTarget,
  onToggle,
  onSelect,
  depth,
}: TreeNodeProps) {
  const { getChildrenCached, getChunkStatus, requestChunk } = usePathsContext()

  const isExpanded = expandedPaths.has(path)
  const isSelected = selectedPath === path
  const isScrollTarget = scrollTarget === path

  // Root dir name: '/Lotus/Weapons' → 'Lotus'; '' → ''
  const rootDir = useMemo(() => path.split('/')[1] ?? '', [path])

  const chunkStatus = isDir ? getChunkStatus(rootDir) : 'loaded'

  // Trigger lazy chunk load when this directory is first expanded
  useEffect(() => {
    if (isExpanded && isDir && rootDir && chunkStatus === 'unloaded') {
      requestChunk(rootDir)
    }
  }, [isExpanded, isDir, rootDir, chunkStatus, requestChunk])

  const children = useMemo(() => {
    if (!isDir || !isExpanded || chunkStatus !== 'loaded') return []
    return getChildrenCached(path)
  }, [isDir, isExpanded, chunkStatus, path, getChildrenCached])

  const indent = depth * 12

  const handleClick = useCallback(() => {
    if (isDir) onToggle(path)
    else onSelect(path)
  }, [isDir, path, onToggle, onSelect])

  if (isDir) {
    return (
      <div>
        <button
          data-path={path}
          onClick={handleClick}
          className={cn(
            'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm transition-colors',
            'hover:bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]',
            isScrollTarget &&
              'ring-1 ring-[var(--color-brand)]/50 bg-[var(--color-surface-hover)]',
          )}
          style={{ paddingLeft: `${indent + 4}px` }}
        >
          <ChevronRight
            size={12}
            className={cn(
              'shrink-0 text-[var(--color-text-dim)] transition-transform duration-150',
              isExpanded && 'rotate-90',
            )}
          />
          {isExpanded ? (
            <FolderOpen size={14} className="shrink-0 text-[var(--color-dir)]" />
          ) : (
            <Folder size={14} className="shrink-0 text-[var(--color-dir)]" />
          )}
          <span className="truncate text-[var(--color-dir)] font-medium">{name}</span>
          {isExpanded && chunkStatus === 'loaded' && children.length > 0 && (
            <span className="ml-auto shrink-0 text-xs text-[var(--color-text-dim)] pr-1">
              {children.length}
            </span>
          )}
          {isExpanded && chunkStatus === 'loading' && (
            <Loader2
              size={11}
              className="ml-auto shrink-0 animate-spin text-[var(--color-brand)] pr-0.5"
            />
          )}
        </button>

        {isExpanded && (
          <div>
            {chunkStatus === 'loading' && (
              <div
                className="flex items-center gap-1.5 py-1 text-xs text-[var(--color-text-dim)]"
                style={{ paddingLeft: `${indent + 28}px` }}
              >
                <Loader2 size={10} className="animate-spin" />
                <span>加载中...</span>
              </div>
            )}

            {chunkStatus === 'error' && (
              <div
                className="flex items-center gap-1.5 py-1 text-xs text-red-400"
                style={{ paddingLeft: `${indent + 28}px` }}
              >
                <AlertCircle size={10} />
                <span>加载失败，点击重试</span>
              </div>
            )}

            {chunkStatus === 'loaded' &&
              children.map((child) => (
                <TreeNode
                  key={child.path}
                  name={child.name}
                  path={child.path}
                  isDir={child.isDir}
                  expandedPaths={expandedPaths}
                  selectedPath={selectedPath}
                  scrollTarget={scrollTarget}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      data-path={path}
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-sm transition-colors',
        isSelected || isScrollTarget
          ? 'bg-[var(--color-selected)] text-[var(--color-brand-light)]'
          : 'hover:bg-[var(--color-surface-hover)] text-[var(--color-file)]',
      )}
      style={{ paddingLeft: `${indent + 20}px` }}
    >
      <FileJson size={13} className="shrink-0 opacity-70" />
      <span className="truncate">{name}</span>
    </button>
  )
})

export default TreeNode
