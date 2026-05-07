import { put, del, head } from '@vercel/blob'

export async function uploadGuideBlob(guideId: string, kv3Content: string): Promise<string> {
  const blob = await put(`cs2annotations/guides/${guideId}/guide.kv3`, kv3Content, {
    access: 'public',
    contentType: 'text/plain',
    addRandomSuffix: false,
  })
  return blob.url
}

export async function deleteGuideBlob(blobKey: string): Promise<void> {
  if (!blobKey) return
  if (!blobKey.startsWith('http')) return
  await del(blobKey)
}

export async function getGuideBlobUrl(blobKey: string): Promise<string> {
  if (!blobKey) return ''
  if (blobKey.startsWith('http')) return blobKey
  // Legacy: blobKey is a pathname — try head() for backward compat
  try {
    const info = await head(blobKey)
    return info.url
  } catch {
    return ''
  }
}
