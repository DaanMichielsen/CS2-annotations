import Link from 'next/link'
import Image from 'next/image'
import { getMapColor, getMapLabel } from '@/lib/mapColors'

interface GuideCardProps {
  id: string
  title: string
  map?: string | null
  nodeCount: number
  score: number
  authorName?: string | null
  authorAvatar?: string | null
}

export default function GuideCard({ id, title, map, nodeCount, score, authorName, authorAvatar }: GuideCardProps) {
  const { accent, dim, icon } = getMapColor(map)
  const mapLabel = getMapLabel(map)

  return (
    <Link
      href={`/guides/${id}`}
      className="group relative block rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700 transition-all duration-200 overflow-hidden"
      style={{ borderLeftColor: accent, borderLeftWidth: '3px' }}
    >
      {/* Map icon watermark */}
      {icon && (
        <div
          className="absolute bottom-0 right-0 w-24 h-24 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity pointer-events-none"
          style={{
            backgroundImage: `url(${icon})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            maskImage: 'radial-gradient(ellipse at bottom right, black 30%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse at bottom right, black 30%, transparent 75%)',
          }}
        />
      )}

      <div className="relative px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-display font-semibold text-[1.05rem] leading-snug text-zinc-100 group-hover:text-white transition-colors line-clamp-2">
            {title}
          </h3>
          {/* Map icon chip */}
          <div
            className="shrink-0 flex items-center gap-1.5 text-[0.65rem] font-data uppercase tracking-widest px-2 py-0.5 rounded mt-0.5"
            style={{ backgroundColor: dim, color: accent }}
          >
            {icon && (
              <Image
                src={icon}
                alt={mapLabel}
                width={14}
                height={14}
                className="opacity-80"
                unoptimized
              />
            )}
            {mapLabel}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          {authorAvatar ? (
            <div className="w-5 h-5 rounded-full overflow-hidden ring-1 ring-zinc-700 shrink-0">
              <Image
                src={authorAvatar}
                alt={authorName ?? 'author'}
                width={20}
                height={20}
                className="w-full h-full object-cover"
                unoptimized
              />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-zinc-700 shrink-0" />
          )}
          <span className="text-xs text-zinc-500 truncate flex-1">{authorName ?? 'Anonymous'}</span>
          <span className="text-xs font-data text-zinc-600">{nodeCount} nodes</span>
          <span
            className="text-xs font-data font-medium ml-1"
            style={{ color: score > 0 ? '#a78bfa' : score < 0 ? '#ef4444' : '#52525b' }}
          >
            {score > 0 ? '+' : ''}{score}
          </span>
        </div>
      </div>
    </Link>
  )
}
