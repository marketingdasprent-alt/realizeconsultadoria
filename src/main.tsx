import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import GlobalErrorBoundary from './components/GlobalErrorBoundary';
import { applyAppManifest } from './lib/app-manifest';
import { startInstallCapture } from './lib/pwa-install';
import { reloadForNewVersion } from './lib/chunk-reload';

// App do admin ou do colaborador, antes de o browser ler o manifest para instalar.
applyAppManifest(window.location.pathname);
// O pedido de instalação chega logo ao abrir: guarda-se para o botão "Instalar".
startInstallCapture();

// Ficheiro de uma versão anterior que já não existe (houve atualização): recarrega uma vez.
window.addEventListener('vite:preloadError', event => {
  if (reloadForNewVersion()) event.preventDefault();
});

// Register service worker with auto-update
registerSW({
  onRegisteredSW(_swUrl, registration) {
    if (registration) {
      // Cada verificação é um pedido ao alojamento (Edge Requests da Vercel): verificar ao
      // voltar à janela (no máximo 1x a cada 15 min) e de hora a hora com a app aberta.
      let lastCheck = Date.now();
      const check = (minGap: number) => {
        if (Date.now() - lastCheck < minGap) return;
        lastCheck = Date.now();
        registration.update();
      };
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check(15 * 60 * 1000);
      });
      setInterval(() => check(0), 60 * 60 * 1000);
    }
  },
  onRegisterError(error) {
    console.error('[PWA] SW registration error:', error);
  },
});

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <App />
  </GlobalErrorBoundary>
);
