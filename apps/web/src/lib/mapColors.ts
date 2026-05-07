export interface MapColor {
  accent: string
  dim: string
  label: string
}

const MAP_COLORS: Record<string, MapColor> = {
  de_mirage:   { accent: '#d97706', dim: 'rgba(217,119,6,0.12)',   label: 'Mirage' },
  de_inferno:  { accent: '#ea580c', dim: 'rgba(234,88,12,0.12)',   label: 'Inferno' },
  de_dust2:    { accent: '#ca8a04', dim: 'rgba(202,138,4,0.12)',   label: 'Dust 2' },
  de_ancient:  { accent: '#0d9488', dim: 'rgba(13,148,136,0.12)', label: 'Ancient' },
  de_anubis:   { accent: '#7c3aed', dim: 'rgba(124,58,237,0.12)', label: 'Anubis' },
  de_nuke:     { accent: '#16a34a', dim: 'rgba(22,163,74,0.12)',  label: 'Nuke' },
  de_overpass: { accent: '#2563eb', dim: 'rgba(37,99,235,0.12)',  label: 'Overpass' },
  de_train:    { accent: '#64748b', dim: 'rgba(100,116,139,0.12)',label: 'Train' },
  de_cache:    { accent: '#65a30d', dim: 'rgba(101,163,13,0.12)', label: 'Cache' },
  de_vertigo:  { accent: '#0891b2', dim: 'rgba(8,145,178,0.12)',  label: 'Vertigo' },
}

const DEFAULT: MapColor = { accent: '#52525b', dim: 'rgba(82,82,91,0.12)', label: '' }

export function getMapColor(map: string | null | undefined): MapColor {
  if (!map) return DEFAULT
  const c = MAP_COLORS[map.toLowerCase()]
  if (c) return c
  return { ...DEFAULT, label: map.replace(/^de_/, '').replace(/_/g, ' ') }
}

export function getMapLabel(map: string | null | undefined): string {
  if (!map) return 'Unknown map'
  return MAP_COLORS[map.toLowerCase()]?.label ?? map.replace(/^de_/, '').replace(/_/g, ' ')
}

export const KNOWN_MAPS = Object.keys(MAP_COLORS)
