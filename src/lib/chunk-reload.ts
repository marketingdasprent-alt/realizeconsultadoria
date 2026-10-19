// Versão nova publicada com a app aberta: as páginas que ainda não tinham sido abertas pedem
// ficheiros da versão anterior, que já não existem ("Failed to fetch dynamically imported
// module"). Nesse caso a app recarrega sozinha para a versão nova, uma vez (sem ciclos).

const RELOAD_KEY = 'rz.chunk-reload-at';
/** Se voltar a falhar logo a seguir a recarregar, mostra o erro em vez de repetir. */
const MIN_INTERVAL_MS = 15_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk \S+ failed/i;

export const isChunkLoadError = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : typeof error === 'string'
        ? error
        : '';
  return CHUNK_ERROR.test(message);
};

/** Recarrega a página para a versão nova; devolve false se já o fez há pouco. */
export const reloadForNewVersion = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sem armazenamento: recarrega na mesma (o browser trata do resto)
  }
  window.location.reload();
  return true;
};
