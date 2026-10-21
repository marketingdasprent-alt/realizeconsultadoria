// /instalar: passos para instalar a app à mão em cada sistema (sem o botão "Instalar").

export type InstallPlatform = 'android' | 'ios' | 'windows' | 'mac';

export const PLATFORM_LABELS: Record<InstallPlatform, string> = {
  android: 'Android',
  ios: 'iPhone / iPad',
  windows: 'Windows',
  mac: 'Mac',
};

export const installStepsFor = (
  platform: InstallPlatform,
  appName: string,
  browser: string
): { steps: string[]; note?: string } => {
  switch (platform) {
    case 'android':
      return {
        steps: [
          ...(browser === 'chrome' || browser === 'samsung' || browser === 'edge'
            ? []
            : ['Abra este endereço no Chrome.']),
          'Toque no menu ⋮, no canto superior direito.',
          'Toque em “Instalar aplicação” (ou “Adicionar ao ecrã principal”).',
          `Confirme em “Instalar”. O ícone ${appName} fica no ecrã principal.`,
        ],
      };
    case 'ios':
      return {
        steps: [
          'Abra este endereço no Safari.',
          'Toque em Partilhar (o quadrado com uma seta para cima), em baixo.',
          'Deslize e escolha “Adicionar ao ecrã principal”.',
          `Toque em “Adicionar”. Abra a ${appName} sempre pelo ícone no ecrã principal.`,
        ],
        note: 'No iPhone as notificações só chegam à app aberta pelo ícone do ecrã principal.',
      };
    case 'windows':
      return {
        steps: [
          'Abra este endereço no Chrome ou no Microsoft Edge.',
          'Clique no ícone “Instalar” à direita da barra de endereço (um ecrã com uma seta).',
          'Sem o ícone: no Chrome, menu ⋮ → “Transmitir, guardar e partilhar” → “Instalar página como app”; no Edge, menu ⋯ → “Aplicações” → “Instalar este site como uma aplicação”.',
          `Clique em “Instalar”. A ${appName} abre em janela própria e fica no menu Iniciar — pode afixá-la na barra de tarefas.`,
        ],
        note:
          browser === 'firefox' ? 'O Firefox não instala apps: use o Chrome ou o Edge.' : undefined,
      };
    case 'mac':
      return {
        steps: [
          'No Chrome ou no Edge: clique no ícone “Instalar” à direita da barra de endereço.',
          'No Safari: menu Ficheiro → “Adicionar à Dock”.',
          `Confirme. A ${appName} fica na Dock e no Launchpad.`,
        ],
        note:
          browser === 'firefox'
            ? 'O Firefox não instala apps: use o Chrome ou o Safari.'
            : undefined,
      };
  }
};
