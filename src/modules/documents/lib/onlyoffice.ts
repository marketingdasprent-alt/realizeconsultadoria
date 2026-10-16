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
