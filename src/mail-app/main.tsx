// Realize Mail (mail.realizeconsultadoria.pt): o Webmail da Realize como app própria para clientes
// de fora. Entra-se com a caixa de email; não há conta da Realize.
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '../index.css';
import '../styles/dark.css';
import '../styles/dark-remap.css';
import GlobalErrorBoundary from '../components/GlobalErrorBoundary';
import { MailApp } from './MailApp';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <GlobalErrorBoundary>
    <MailApp />
  </GlobalErrorBoundary>
);
