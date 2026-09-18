import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const missingSupabaseEnv = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter((name) => !env[name]);

  if (missingSupabaseEnv.length > 0) {
    throw new Error(
      `Missing required frontend environment variables: ${missingSupabaseEnv.join(', ')}`
    );
  }

  return ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mcpPlugin(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'fun-profile-logo-128.webp', 'apple-touch-icon.png'],
      manifest: {
        name: 'FUN Profile - Connect, Share, Earn',
        short_name: 'FUN Profile',
        description: 'Mạng xã hội Web3 kết hợp AI. Kết nối bạn bè, chia sẻ nội dung, kiếm phần thưởng Camly Coin.',
        theme_color: '#22c55e',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff2}'],
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        navigateFallbackAllowlist: [/^\/(?!api\/|functions\/).*/],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB - for large Web3 chunks
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 4,
              expiration: {
                maxEntries: 1,
                maxAgeSeconds: 60 * 60
              },
              cacheableResponse: {
                statuses: [200]
              }
            }
          },
          {
            urlPattern: ({ url }) => url.pathname === '/version.json',
            handler: 'NetworkOnly',
            options: {
              cacheName: 'app-version'
            }
          },
          {
            urlPattern: /^https:\/\/bhtsnervqiwchluwuxki\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300
              }
            }
          },
          {
            urlPattern: /^https:\/\/media\.fun\.rich\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'media-images',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/modules": path.resolve(__dirname, "./src/modules"),
      "@/shared": path.resolve(__dirname, "./src/shared"),
      "@fun/chat": path.resolve(__dirname, "./packages/fun-chat/src"),
      "@fun/chat-call": path.resolve(__dirname, "./packages/fun-chat-call/src"),
    },
  },
  build: {
    sourcemap: mode === 'development',
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 300,
  },

  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@tanstack/react-query',
      '@supabase/supabase-js',
      'eventemitter3',
      'recharts',
    ],
    esbuildOptions: {
      target: 'esnext',
    },
  },
  // Performance hints
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
    legalComments: 'none',
  },
  });
});
