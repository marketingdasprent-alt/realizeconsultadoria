import type { CapacitorConfig } from '@capacitor/cli';

// App Android do Realize. Carrega o site ao vivo (app.realizeconsultadoria.pt): cada deploy na
// Vercel chega logo à app; só mudanças nativas (plugins, ícones, permissões) pedem nova versão.
// O pacote é o mesmo da app que já está no Play Console, para atualizar essa.
const config: CapacitorConfig = {
  appId: 'com.realizeconsultadoria.myapp',
  appName: 'Realize',
  // Usado só se a app abrir sem rede no primeiro arranque (página de recurso).
  webDir: 'dist',
  server: {
    url: 'https://app.realizeconsultadoria.pt',
    androidScheme: 'https',
    // Ficam dentro da app; o resto (links de emails, sites) abre no navegador.
    allowNavigation: [
      'app.realizeconsultadoria.pt',
      'admin.realizeconsultadoria.pt',
      '*.supabase.co',
    ],
  },
  android: {
    // Telemóveis Android 7+ (WebView com o Chrome atualizado).
    minWebViewVersion: 80,
  },
};

export default config;
