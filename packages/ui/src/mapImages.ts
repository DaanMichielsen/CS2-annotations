/// <reference path="../../shared/src/vite-env.d.ts" />

import { MAP_DATA } from '@cs2ann/shared'

// Vite bundles and hashes these at build time.
const imageModules = {
  ...(import.meta.glob('../../../apps/desktop/resources/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../../../apps/desktop/resources/maps/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
}

export function getMapImageUrl(fileName: string): string | null {
  return (
    imageModules[`../../../apps/desktop/resources/${fileName}`] ??
    imageModules[`../../../apps/desktop/resources/maps/${fileName}`] ??
    null
  )
}

/** Returns a bundled image URL for use as a map icon chip in the desktop UI. */
export function getMapIconUrl(mapName: string): string | null {
  const data = MAP_DATA[mapName.toLowerCase()]
  return data ? getMapImageUrl(data.file) : null
}
