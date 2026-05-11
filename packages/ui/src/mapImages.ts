/// <reference path="../../shared/src/vite-env.d.ts" />

// Vite bundles and hashes these at build time.

// Large radar/overview images — used for the canvas map overlay.
const overviewModules = {
  ...(import.meta.glob('../../../apps/desktop/resources/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../../../apps/desktop/resources/maps/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
}

// Small map icon images — used for filter chips and guide list items.
const iconModules = import.meta.glob('../../../apps/desktop/resources/map-icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

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
