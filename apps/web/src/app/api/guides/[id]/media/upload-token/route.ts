import { NextRequest, NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { canCreateMedia } from '@/lib/mediaAuth'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: guideId } = await params
  const body = (await req.json()) as HandleUploadBody

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => {
        const userId = await canCreateMedia(guideId, req)
        if (!userId) throw new Error('Forbidden')
        return {
          allowedContentTypes: [
            'video/mp4', 'video/webm', 'video/quicktime',
            'image/jpeg', 'image/png', 'image/webp',
          ],
        }
      },
      onUploadCompleted: async () => {},
    })
    return NextResponse.json(jsonResponse)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 400 }
    )
  }
}
