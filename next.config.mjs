/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure static export works properly
  trailingSlash: true,
  // Add output for better Railway compatibility
  output: 'standalone',
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
