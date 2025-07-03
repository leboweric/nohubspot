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
  },
  // Ensure we're not using static export which disables API routes
  trailingSlash: false,
  // Enable server-side rendering for all pages
  output: undefined  // Don't use 'export' - this disables API routes
}

export default nextConfig
