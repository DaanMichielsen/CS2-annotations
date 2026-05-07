import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@cs2ann/shared', '@cs2ann/ui']
}

export default nextConfig