import type { NextConfig } from 'next'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const withPWA = require('next-pwa')({
  dest: 'public',
  skipWaiting: true,
  register: true,
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: '10mb' },
  },
  serverExternalPackages: ['@react-pdf/renderer'],
}

export default withPWA(nextConfig)
