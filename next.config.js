/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compression and caching
  compress: true,
  poweredByHeader: false,
  
  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Enable SWR (Stale While Revalidate) with proper caching
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=120'
          }
        ]
      }
    ];
  },

  // Optimize bundle
  swcMinify: true,

  // Enable experimental optimizations
  experimental: {
    optimizePackageImports: ['react-dom', '@prisma/client'],
  },
};

export default nextConfig;