interface Props {
  count: number
}

export default function MediaCoverageBar({ count }: Props) {
  if (count === 0) return null
  return (
    <span className="inline-flex items-center gap-1 text-[0.6rem] font-data px-1.5 py-0.5 rounded bg-violet-950/60 border border-violet-900/50 text-violet-400">
      📷 {count}
    </span>
  )
}
