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
  },
  // Exclude dynamic routes that cause issues with static export
  exportPathMap: async function (defaultPathMap) {
    return {
      '/': { page: '/' },
      '/dashboard': { page: '/dashboard' },
      '/contacts': { page: '/contacts' },
      '/contacts/new': { page: '/contacts/new' },
      '/companies': { page: '/companies' },
      '/companies/new': { page: '/companies/new' },
      '/tasks': { page: '/tasks' },
      '/settings': { page: '/settings' },
    }
  }
}

export default nextConfig
