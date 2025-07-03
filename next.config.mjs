/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for static export to work with Netlify
  output: 'export',
  trailingSlash: true,
  skipTrailingSlashRedirect: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Disable server-side features for static export
  experimental: {
    esmExternals: 'loose'
  }
}

export default nextConfig
