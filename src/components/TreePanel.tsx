import { useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { usePathsContext } from '../lib/PathsContext'
import TreeNode from './TreeNode'

interface TreePanelProps {
  expandedPaths: Set<string>
  selectedPath: string | null
  scrollTarget: string | null
  searchQuery: string
  onToggle: (path: string) => void
  onSelect: (path: string) => void
  onSearchChange: (q: string) => void
  onSearchClear: () => void
  focusSearchRef: React.RefObject<HTMLInputElement | null>
}

export default function TreePanel({
  expandedPaths,
  selectedPath,
  scrollTarget,
  searchQuery,
  onToggle,
  onSelect,
  onSearchChange,
  onSearchClear,
  focusSearchRef,
}: TreePanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { getChildrenCached } = usePathsContext()

  useEffect(() => {
    ;(focusSearchRef as React.MutableRefObject<HTMLInputElement | null>).current =
      inputRef.current
  }, [focusSearchRef])

  const rootChildren = getChildrenCached('')

  return (
    <div className="flex h-full flex-col border-r border-[var(--color-border)]">
      {/* Search bar */}
      <div className="shrink-0 border-b border-[var(--color-border)] p-2">
        <div className="relative flex items-center">
          <Search
            size={14}
            className="absolute left-2.5 text-[var(--color-text-dim)] pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="/Lotus/Weapons/…"
            className={cn(
              'w-full rounded border border-[var(--color-border)] bg-[var(--color-surface-overlay)]',
              'py-1.5 pl-8 pr-8 text-sm text-[var(--color-text-primary)] font-mono',
              'placeholder:text-[var(--color-text-dim)] placeholder:font-sans',
              'outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]',
              'transition-colors',
            )}
          />
          {searchQuery && (
            <button
              onClick={onSearchClear}
              className="absolute right-2 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {searchQuery && (
          <p className="mt-1.5 text-xs text-[var(--color-text-dim)]">
            路径导航 · 按 Esc 清除
          </p>
        )}
      </div>

      {/* File tree — always visible, navigates on search */}
      <div className="flex-1 overflow-y-auto p-1">
        {rootChildren.map((child) => (
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
            depth={0}
          />
        ))}
      </div>
    </div>
  )
}
