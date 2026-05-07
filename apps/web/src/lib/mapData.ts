export interface MapOverviewData {
  file: string
  posX: number
  posY: number
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
