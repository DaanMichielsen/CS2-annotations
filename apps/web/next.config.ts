import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@cs2ann/shared', '@cs2ann/ui'],
  webpack(config) {
    // Replace Vite-only mapImages (uses import.meta.glob) with a no-op stub for webpack/Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.resolve(__dirname, '../../packages/ui/src/mapImages')]:
        path.resolve(__dirname, '../../packages/ui/src/mapImages.web'),
      [path.resolve(__dirname, '../../packages/ui/src/nadeImages')]:
        path.resolve(__dirname, '../../packages/ui/src/nadeImages.web'),
    }
    return config
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.steamstatic.com'
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net'
      },
      {
        protocol: 'https',
        hostname: 'community.fastly.steamstatic.com'
      }
    ]
  }
}

export default nextConfig
