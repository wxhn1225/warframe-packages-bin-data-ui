import { useState, useEffect } from 'react'
import { ExternalLink, Copy, Check, FileJson, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

interface DetailPanelProps {
  selectedPath: string | null
  submoduleUrl: string
  submoduleCommit: string
}

export default function DetailPanel({
  selectedPath,
  submoduleUrl,
  submoduleCommit,
}: DetailPanelProps) {
  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!selectedPath) {
      setContent(null)
      setError(null)
      return
    }

    setLoading(true)
    setContent(null)
    setError(null)

    const rawUrl = `https://raw.githubusercontent.com/${submoduleUrl.replace('https://github.com/', '')}/${submoduleCommit}${selectedPath}.json`

    fetch(rawUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.text()
      })
      .then((text) => {
        try {
          const parsed = JSON.parse(text)
          setContent(JSON.stringify(parsed, null, 2))
        } catch {
          setContent(text)
        }
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : String(e))
      })
      .finally(() => setLoading(false))
  }, [selectedPath, submoduleUrl, submoduleCommit])

  const handleCopyPath = () => {
    if (!selectedPath) return
    void navigator.clipboard.writeText(selectedPath).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  if (!selectedPath) {
    return (
      <div className="flex h-full flex-col items-center justify-center text-[var(--color-text-dim)]">
        <FileJson size={48} className="mb-4 opacity-20" />
        <p className="text-base">从左侧选择一个文件</p>
        <p className="mt-1 text-sm opacity-60">或使用搜索框查找路径</p>
        <p className="mt-4 text-xs opacity-40">快捷键：Ctrl+K 聚焦搜索</p>
      </div>
    )
  }

  const githubUrl = `${submoduleUrl}/blob/${submoduleCommit}${selectedPath}.json`

  const parts = selectedPath.split('/').filter(Boolean)

  return (
    <div className="flex h-full flex-col">
      {/* File path header */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3">
        <div className="mb-2 flex items-center gap-2">
          <FileJson size={16} className="shrink-0 text-[var(--color-brand)]" />
          <span className="text-base font-semibold text-[var(--color-text-primary)]">
            {parts[parts.length - 1]}
          </span>
          <span className="text-xs text-[var(--color-text-dim)]">.json</span>
        </div>

        {/* Breadcrumb */}
        <div className="flex flex-wrap items-center gap-0.5 text-xs text-[var(--color-text-dim)]">
          {parts.map((part, i) => (
            <span key={i} className="flex items-center gap-0.5">
              {i > 0 && <span className="opacity-40">/</span>}
              <span
                className={cn(
                  i === parts.length - 1
                    ? 'text-[var(--color-text-primary)] font-medium'
                    : 'text-[var(--color-text-dim)]',
                )}
              >
                {part}
              </span>
            </span>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleCopyPath}
            className={cn(
              'flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2.5 py-1.5',
              'text-xs transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]',
              'text-[var(--color-text-muted)]',
            )}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? '已复制' : '复制路径'}
          </button>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-1.5 rounded border border-[var(--color-border)] px-2.5 py-1.5',
              'text-xs transition-colors hover:border-[var(--color-brand)] hover:text-[var(--color-brand)]',
              'text-[var(--color-text-muted)]',
            )}
          >
            <ExternalLink size={12} />
            在 GitHub 查看
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-dim)]">
            <Loader2 size={14} className="animate-spin" />
            加载中...
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span>加载失败：{error}</span>
          </div>
        )}
        {content && (
          <pre className="text-[13px] leading-relaxed text-[var(--color-text-primary)] whitespace-pre-wrap break-all">
            <JsonHighlight content={content} />
          </pre>
        )}
      </div>
    </div>
  )
}

/** Simple JSON syntax highlighter */
function JsonHighlight({ content }: { content: string }) {
  const highlighted = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            return `<span style="color:#60a5fa">${match}</span>`
          }
          return `<span style="color:#86efac">${match}</span>`
        }
        if (/true|false/.test(match)) {
          return `<span style="color:#f59e0b">${match}</span>`
        }
        if (/null/.test(match)) {
          return `<span style="color:#71717a">${match}</span>`
        }
        return `<span style="color:#c084fc">${match}</span>`
      },
    )

  return <span dangerouslySetInnerHTML={{ __html: highlighted }} />
}
