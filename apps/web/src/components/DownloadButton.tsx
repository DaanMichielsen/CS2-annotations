'use client'
import { useState } from 'react'
import { Download, X } from 'lucide-react'

interface Props {
  downloadUrl: string
  guideTitle: string
  mapName: string | null
}

export default function DownloadButton({ downloadUrl, guideTitle, mapName }: Props) {
  const [showModal, setShowModal] = useState(false)
  const fileName = guideTitle.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.txt'
  const folderName = mapName ? `${mapName}\\` : ''

  function handleDownload() {
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    a.click()
    setShowModal(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownload}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-600 text-sm font-medium transition-colors"
      >
        <Download size={15} className="text-zinc-400" />
        Download
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <h2 className="font-display font-bold text-white text-lg">Manual installation</h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-zinc-500 hover:text-zinc-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-zinc-400 text-sm mb-5 leading-relaxed">
              Your file <span className="font-mono text-zinc-200 bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{fileName}</span> is downloading.
              Place it in your CS2 annotations folder:
            </p>

            <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 mb-5">
              <p className="text-[0.7rem] font-data text-zinc-500 mb-1 uppercase tracking-wider">Folder path</p>
              <p className="font-mono text-xs text-zinc-300 leading-relaxed break-all">
                {'[Steam]\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg\\'}
                <span className="text-violet-300">{folderName}{fileName}</span>
              </p>
            </div>

            <p className="text-[0.75rem] text-zinc-600 mb-5 leading-relaxed">
              Create the folder if it does not exist. In CS2, run{' '}
              <span className="font-mono text-zinc-400 bg-zinc-800 px-1 rounded">annotation_load {guideTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')}</span>{' '}
              in the console to load it.
            </p>

            <div className="border-t border-zinc-800 pt-4">
              <p className="text-[0.75rem] text-zinc-600">
                <span className="text-violet-400 font-medium">Tip:</span> The{' '}
                <a
                  href="https://github.com/DaanMichielsen/CS2-annotations/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="text-violet-400 hover:text-violet-300 underline"
                >
                  desktop app
                </a>{' '}
                handles placement automatically — save the guide and pull it in one click.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
