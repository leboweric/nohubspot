/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for Netlify deployment with middleware and API routes enabled
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    esmExternals: 'loose'
  }
}

export default nextConfig
