/// <reference path="../../shared/src/vite-env.d.ts" />

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
