// Carregamento do editor ONLYOFFICE (api.js do office.dasprent.pt), uma vez por página.

export interface DocEditorInstance {
  destroyEditor: () => void;
}

interface DocsApi {
  DocEditor: new (elementId: string, config: Record<string, unknown>) => DocEditorInstance;
}

declare global {
  interface Window {
    DocsAPI?: DocsApi;
  }
}

let loading: Promise<DocsApi> | null = null;

/** Carrega o api.js do ONLYOFFICE; se falhar, a tentativa seguinte volta a pedir o script. */
export const loadDocsApi = (src: string): Promise<DocsApi> => {
  if (window.DocsAPI) return Promise.resolve(window.DocsAPI);
  if (loading) return loading;
  loading = new Promise<DocsApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () =>
      window.DocsAPI ? resolve(window.DocsAPI) : reject(new Error('DocsAPI em falta'));
    script.onerror = () => reject(new Error('Não foi possível carregar o editor'));
    document.body.appendChild(script);
  }).catch(error => {
    loading = null;
    document.querySelector(`script[src="${src}"]`)?.remove();
    throw error;
  });
  return loading;
};

const OFFICE_URL = 'https://office.dasprent.pt';
let preloaded = false;

/**
 * Pré-carrega o editor (página do próprio ONLYOFFICE, escondida): os ficheiros dele ficam na
 * cache do browser e o primeiro documento abre mais depressa. Uma vez por sessão.
 */
export const preloadEditor = () => {
  if (preloaded || typeof document === 'undefined') return;
  preloaded = true;
  const frame = document.createElement('iframe');
  frame.src = `${OFFICE_URL}/web-apps/apps/api/documents/preload.html`;
  frame.title = 'Pré-carregamento do editor';
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:absolute;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  // Depois de carregar, sai (os ficheiros já estão na cache).
  setTimeout(() => frame.remove(), 60_000);
};
