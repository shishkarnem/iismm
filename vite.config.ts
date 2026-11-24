import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import type {Plugin, UserConfig} from 'vite';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

/**
 * Prevents @vite/client from opening WebSockets or polling :24678 (waitForSuccessfulPing)
 * when running in dev mode behind Caddy HTTPS reverse proxies or inside preview iframes,
 * while keeping updateStyle / removeStyle / createHotContext exports intact.
 */
function disableViteClientWebSocketPlugin(): Plugin {
  return {
    name: 'disable-vite-client-websocket',
    enforce: 'post',
    transform(code, id) {
      const normalizedId = id.replace(/\\/g, '/');
      if (normalizedId.includes('vite/dist/client/client.mjs')) {
        return {
          code: code
            .replace('console.debug("[vite] connecting...");', '/* vite ws disabled */')
            .replace(
              'transport.connect(createHMRHandler(handleMessage));',
              '/* vite ws transport disabled */'
            )
            .replace('throw new Error("send was called before connect");', 'return;')
            .replace('throw new Error("invoke was called before connect");', 'return;'),
          map: null,
        };
      }
      return null;
    },
  };
}

export default defineConfig((): UserConfig => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          importScripts: ['/sw-push.js'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,woff,woff2,webmanifest}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallback: null,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'classic',
        },
      }),
      disableViteClientWebSocketPlugin(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '0.0.0.0',
      allowedHosts: true,
      hmr: false,
      ws: false,
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      modulePreload: false,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom'],
            'vendor-icons': ['lucide-react'],
            'vendor-motion': ['motion'],
          },
        },
      },
    },
  };
});
