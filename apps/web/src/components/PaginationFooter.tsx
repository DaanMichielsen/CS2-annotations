// apps/web/src/components/PaginationFooter.tsx
import Link from 'next/link'

function getPageRange(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

interface PaginationFooterProps {
  currentPage: number
  totalPages: number
  createHref: (page: number) => string
}

export function PaginationFooter({ currentPage, totalPages, createHref }: PaginationFooterProps) {
  if (totalPages <= 1) return null
  const pages = getPageRange(currentPage, totalPages)
  const base = 'text-xs px-2.5 py-1.5 rounded transition-colors'
  const active = 'bg-violet-600 text-white font-semibold'
  const inactive = 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
  const disabled = 'text-zinc-700 pointer-events-none'

  return (
    <nav className="flex items-center justify-center gap-1 mt-10" aria-label="Pagination">
      <Link
        href={createHref(currentPage - 1)}
        className={`${base} ${currentPage <= 1 ? disabled : inactive}`}
        aria-disabled={currentPage <= 1}
      >
        ← Prev
      </Link>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`ellipsis-${i}`} className="text-xs text-zinc-600 px-1">…</span>
        ) : (
          <Link
            key={p}
            href={createHref(p)}
            className={`${base} ${p === currentPage ? active : inactive}`}
            aria-current={p === currentPage ? 'page' : undefined}
          >
            {p}
          </Link>
        )
      )}
      <Link
        href={createHref(currentPage + 1)}
        className={`${base} ${currentPage >= totalPages ? disabled : inactive}`}
        aria-disabled={currentPage >= totalPages}
      >
        Next →
      </Link>
    </nav>
  )
}
