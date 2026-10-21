import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      // O manifest vai com cookies: nas pré-visualizações protegidas da Vercel, sem eles o
      // pedido é desviado para o login e falha por CORS.
      useCredentials: true,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Realize - Portal de Gestão',
        short_name: 'Realize',
        description:
          'Realize Consultadoria: o Workspace do colaborador (ponto, férias, documentos e recibos) e o admin, na mesma app.',
        theme_color: '#B7933D',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'pt',
        // App de app.realizeconsultadoria.pt (Workspace e admin). A do admin.realizeconsultadoria.pt
        // tem o seu manifest em public/manifest-admin.webmanifest; src/lib/app-manifest.ts escolhe.
        id: '/colaborador',
        start_url: '/colaborador',
        scope: '/',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            // Com margem: o Android recorta o ícone em círculo/forma do tema.
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Notificações push (recebidas e tocadas): public/push-sw.js
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{ico,png,svg,woff,woff2}'],
        navigateFallback: null,
        navigateFallbackDenylist: [/^\/~oauth/],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin &&
              (request.destination === 'document' ||
                request.destination === 'script' ||
                request.destination === 'style'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'app-shell',
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Só as imagens e fontes do próprio site: as de outros sites (ex.: dentro dos emails)
            // vão direto à rede, senão o service worker falhava-as ("no-response").
            urlPattern: ({ request, sameOrigin }) =>
              sameOrigin && (request.destination === 'image' || request.destination === 'font'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'static-assets',
              expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
