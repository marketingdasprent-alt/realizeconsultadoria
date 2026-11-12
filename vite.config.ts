import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import fs from 'fs';
import path from 'path';
import { componentTagger } from 'lovable-tagger';
import { VitePWA } from 'vite-plugin-pwa';

// Realize Mail (mail.realizeconsultadoria.pt): `vite build --mode mail` compila só a app de email
// (mail.html → dist-mail/index.html), com o nome e o manifest dela.
const isMail = (mode: string) => mode === 'mail';

/** No modo mail a página de entrada é mail.html: sai como index.html (o site serve-a na raiz). */
const mailAsIndex = () => ({
  name: 'mail-as-index',
  closeBundle() {
    const from = path.resolve(__dirname, 'dist-mail', 'mail.html');
    if (fs.existsSync(from))
      fs.renameSync(from, path.resolve(__dirname, 'dist-mail', 'index.html'));
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: '::',
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
    isMail(mode) && mailAsIndex(),
    VitePWA({
      registerType: 'autoUpdate',
      // O manifest vai com cookies: nas pré-visualizações protegidas da Vercel, sem eles o
      // pedido é desviado para o login e falha por CORS.
      useCredentials: true,
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: isMail(mode)
        ? {
            name: 'Realize Mail',
            short_name: 'Realize Mail',
            description: 'As suas caixas de email numa só app.',
            theme_color: '#B7933D',
            background_color: '#ffffff',
            display: 'standalone',
            lang: 'pt',
            id: '/',
            start_url: '/',
            scope: '/',
            categories: ['productivity'],
            icons: [
              { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
              { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
              {
                src: 'pwa-maskable-512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
              },
            ],
          }
        : {
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
  build: {
    // Pasta /a2 (antes /assets): a cache do Cloudflare em app. guardou HTML no lugar de alguns .js de
    // /assets a 04/11; numa pasta nova esses pedidos estragados deixam de existir.
    assetsDir: 'a2',
    // Realize Mail: só a app de email, noutra pasta (publicada noutro site do Cloudflare)
    ...(isMail(mode) ? { outDir: 'dist-mail' } : {}),
    rollupOptions: {
      ...(isMail(mode) ? { input: path.resolve(__dirname, 'mail.html') } : {}),
      output: {
        // Se voltar a acontecer (HTML guardado no lugar de um .js), mudar a pasta (a3, a4…) em
        // dois deploys: primeiro public/<pasta>/404.html e o _headers, depois esta mudança.
        entryFileNames: 'a2/[name]-[hash].js',
        chunkFileNames: 'a2/[name]-[hash].js',
        assetFileNames: 'a2/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
