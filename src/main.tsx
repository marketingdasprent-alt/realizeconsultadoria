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
      // Check for updates every 60 seconds
      setInterval(() => {
        registration.update();
      }, 60 * 1000);
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
