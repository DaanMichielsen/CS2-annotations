import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@cs2ann/shared', '@cs2ann/ui'],
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
