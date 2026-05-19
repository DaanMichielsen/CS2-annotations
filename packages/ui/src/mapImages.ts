/// <reference path="../../shared/src/vite-env.d.ts" />

// Vite bundles and hashes these at build time.
// In non-Vite environments (Next.js/webpack) import.meta.glob is unavailable — modules fall back to {}.

let overviewModules: Record<string, string> = {}
let iconModules: Record<string, string> = {}

try {
  overviewModules = {
    ...(import.meta.glob('../../../apps/desktop/resources/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
    ...(import.meta.glob('../../../apps/desktop/resources/maps/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  }
  iconModules = import.meta.glob('../../../apps/desktop/resources/map-icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
} catch {
  // webpack / Next.js — map image bundling not available; consumers fall back to null
}

/** Returns the bundled radar/overview image URL for canvas rendering. */
export function getMapOverviewUrl(fileName: string): string | null {
  return (
    overviewModules[`../../../apps/desktop/resources/${fileName}`] ??
    overviewModules[`../../../apps/desktop/resources/maps/${fileName}`] ??
    null
  )
}

/** Returns the bundled small icon URL for a map name (e.g. "de_mirage"). */
export function getMapIconUrl(mapName: string): string | null {
  const shortName = mapName.toLowerCase().replace(/^de_/, '')
  return iconModules[`../../../apps/desktop/resources/map-icons/${shortName}.png`] ?? null
}
