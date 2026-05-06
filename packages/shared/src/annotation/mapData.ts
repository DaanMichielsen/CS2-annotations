/**
 * CS2 overview map coordinate data.
 *
 * Each entry provides the world coordinates of the top-left corner of the 800×800 map
 * image (posX, posY) and the number of world-units per pixel (scale).
 *
 * Derived from the official CS2 game overview files (1024px base values) rescaled to 800px:
 *   scale_800 = scale_1024 × (1024 / 800)
 *
 * Conversion formulas:
 *   pixelX = (worldX - posX) / scale
 *   pixelY = (posY  - worldY) / scale
 */

export interface MapOverviewData {
  /** Image file name inside resources/ */
  file: string
  /** World X coordinate of the left edge of the image */
  posX: number
  /** World Y coordinate of the top edge of the image */
  posY: number
  /** World units per pixel (calibrated for 800×800 images) */
  scale: number
}

export const MAP_DATA: Record<string, MapOverviewData> = {
  de_ancient:  { file: 'ancient.png',  posX: -2953, posY:  2164, scale: 6.400  },
  de_anubis:   { file: 'anubis.png',   posX: -2796, posY:  3328, scale: 6.682  },
  de_cache:    { file: 'cache.png',    posX: -2000, posY:  3250, scale: 7.040  },
  de_dust2:    { file: 'dust2.png',    posX: -2476, posY:  3239, scale: 5.632  },
  de_inferno:  { file: 'inferno.png',  posX: -2087, posY:  3870, scale: 6.272  },
  de_mirage:   { file: 'mirage.png',   posX: -3230, posY:  1713, scale: 6.400  },
  de_nuke:     { file: 'nuke.png',     posX: -3453, posY:  2887, scale: 8.960  },
  de_overpass: { file: 'overpass.png', posX: -4831, posY:  1781, scale: 6.656  },
  de_train:    { file: 'train.png',    posX: -2477, posY:  2401, scale: 6.016  },
}

// Vite bundles and hashes these at build time; support both old and monorepo paths.
const imageModules = {
  ...(import.meta.glob('../../resources/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../../resources/maps/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../../../../apps/desktop/resources/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
  ...(import.meta.glob('../../../../apps/desktop/resources/maps/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>),
}

export function getMapImageUrl(fileName: string): string | null {
  return (
    imageModules[`../../resources/${fileName}`] ??
    imageModules[`../../resources/maps/${fileName}`] ??
    imageModules[`../../../../apps/desktop/resources/${fileName}`] ??
    imageModules[`../../../../apps/desktop/resources/maps/${fileName}`] ??
    null
  )
}

/** Convert in-game world coordinates to pixel coordinates within an 800×800 overview image. */
export function worldToPixel(
  worldX: number,
  worldY: number,
  map: MapOverviewData
): { x: number; y: number } {
  return {
    x: (worldX - map.posX) / map.scale,
    y: (map.posY - worldY) / map.scale,
  }
}

/** Build a setpos + setang console command from a position and angles array. */
export function buildSetposCommand(
  position: [number, number, number],
  angles?: [number, number, number]
): string {
  const [x, y, z] = position
  const pos = `setpos ${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)}`
  if (!angles) return pos
  const [pitch, yaw] = angles
  return `${pos}; setang ${pitch.toFixed(2)} ${yaw.toFixed(2)} 0`
}
