// Browser editing is not yet available — the GuideEditor component requires Vite
// (import.meta.glob) and cannot run in Next.js. Use the desktop app to edit guides.
import Link from 'next/link'

export default function EditGuidePage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 className="text-xl font-semibold text-zinc-100 mb-3">Browser editor coming soon</h1>
      <p className="text-zinc-400 mb-6">
        Guide editing in the browser is not yet available. Open the desktop app to edit this guide,
        then push your changes to the cloud.
      </p>
      <Link
        href="/my-guides"
        className="text-sm text-zinc-300 hover:text-zinc-100 underline underline-offset-2"
      >
        Back to My Guides
      </Link>
    </div>
  )
}
