import { put, del, head } from '@vercel/blob'

export async function uploadGuideBlob(guideId: string, kv3Content: string): Promise<string> {
  const blob = await put(`guides/${guideId}/guide.kv3`, kv3Content, {
    access: 'public',
    contentType: 'text/plain',
  })
  return blob.pathname
}

export async function deleteGuideBlob(blobKey: string): Promise<void> {
  await del(blobKey)
}

export async function getGuideBlobUrl(blobKey: string): Promise<string> {
  const info = await head(blobKey)
  return info.url
}
