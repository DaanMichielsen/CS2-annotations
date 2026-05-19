/// <reference path="../../shared/src/vite-env.d.ts" />

// Vite bundles and hashes these at build time.
const _nadeIconModules = import.meta.glob(
  '../../../apps/desktop/resources/nades/*.png',
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>

const NADE_FILE: Record<string, string> = {
  smoke: 'smoke', flash: 'flash', he: 'hegrenade', molotov: 'molotov', decoy: 'decoy',
}

export function getNadeIconUrl(grenadeType: string): string | null {
  const file = NADE_FILE[grenadeType]
  if (!file) return null
  return _nadeIconModules[`../../../apps/desktop/resources/nades/${file}.png`] ?? null
}
