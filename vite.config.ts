import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const cleanEnvUrl = (val?: string) =>
    val && !val.includes('myapp-backend.onrender.com') && !val.includes('YOUR_') ? val : '';

  return {
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(cleanEnvUrl(process.env.VITE_API_URL)),
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(cleanEnvUrl(process.env.VITE_API_BASE_URL)),
      'import.meta.env.VITE_WS_URL': JSON.stringify(cleanEnvUrl(process.env.VITE_WS_URL)),
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['apple-touch-icon.png', 'icon.svg', 'robots.txt'],
        manifest: {
          id: '/',
          name: 'Beacon - Real-Time Location & Community Mesh',
          short_name: 'Beacon',
          description:
            'Production real-time location sharing, private rooms, live voice channels, community emergency alerts, and mapping.',
          theme_color: '#0f172a',
          background_color: '#0f172a',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/assets/aistudio/**'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/ws/, /^\/sitemap\.xml$/, /^\/robots\.txt$/],
          cleanupOutdatedCaches: true,
        },
        devOptions: {
          enabled: true,
          type: 'module',
        },
      }),
    ],
    build: {
      target: 'es2020',
      cssMinify: true,
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('leaflet')) return 'vendor-leaflet';
              if (id.includes('lucide-react')) return 'vendor-icons';
              if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
              if (id.includes('react-dom') || id.includes('/react/')) return 'vendor-react';
            }
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
