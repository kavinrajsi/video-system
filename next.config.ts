// next.config.ts - Fixed configuration for service worker generation
import { NextConfig } from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  // IMPORTANT: Only disable in development, enable in production
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
  
  // Enhanced runtime caching for video display system
  runtimeCaching: [
    // Cache Vercel Blob videos with longer retention
    {
      urlPattern: /^https:\/\/blob\.vercel-storage\.com\/.*\.(mp4|webm|mov|avi)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'vercel-blob-videos',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    
    // Cache local video files
    {
      urlPattern: /^https?:\/\/.*\.(mp4|webm|ogg|mov|avi)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'video-files',
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    
    // Cache API responses (for video metadata)
    {
      urlPattern: /^https?:\/\/.*\/api\/(videos|upload).*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    
    // Cache Supabase API calls
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/.*$/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 5 * 60, // 5 minutes
        },
        networkTimeoutSeconds: 10,
      },
    },
    
    // Cache static assets
    {
      urlPattern: /^https?:\/\/.*\.(js|css|woff|woff2|ttf|eot)$/,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'static-assets',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    
    // Cache images
    {
      urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'images',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
  ],
  
  // Additional workbox options
  workboxOptions: {
    skipWaiting: true,
    clientsClaim: true,
  },
});

export default pwaConfig(nextConfig);