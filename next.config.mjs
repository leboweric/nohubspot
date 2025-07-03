/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configure for standalone deployment instead of static export
  output: 'standalone',
  trailingSlash: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
