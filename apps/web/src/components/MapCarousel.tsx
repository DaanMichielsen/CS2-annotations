'use client'

import { HERO_MAPS } from '@/lib/mapColors'

const DURATION = HERO_MAPS.length * 5 // 5s per map, total cycle

export default function MapCarousel() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {HERO_MAPS.map(({ src, label }, i) => (
        <div
          key={src}
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(${src})`,
            animation: `mapfade ${DURATION}s ease-in-out infinite`,
            animationDelay: `${-i * 5}s`,
            willChange: 'opacity',
          }}
          title={label}
        />
      ))}

      {/* Gradient overlays for text readability */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(9,9,15,0.92) 0%, rgba(9,9,15,0.7) 55%, rgba(9,9,15,0.4) 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(9,9,15,0.6) 0%, transparent 40%)' }} />

      {/* Subtle scanline texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0.5) 1px, transparent 1px, transparent 4px)',
        }}
      />
    </div>
  )
}
