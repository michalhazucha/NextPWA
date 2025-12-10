/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Note: headers() is not supported with static export
  // Headers should be configured at the CDN/server level (e.g., in Render)
}

export default nextConfig
