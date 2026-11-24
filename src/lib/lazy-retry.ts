// Carregar um ficheiro da app (página ou biblioteca) pode falhar de forma passageira: o browser
// recusa o pedido sem chegar à rede ("Failed to fetch dynamically imported module") e, logo a
// seguir, o mesmo ficheiro abre bem. Por isso tenta-se de novo, em silêncio, antes de mostrar
// o ecrã de erro. Se continuar a falhar (versão nova publicada), o erro segue para o
// recarregamento automático de `chunk-reload`.
import { lazy, type ComponentType } from 'react';
import { isChunkLoadError } from './chunk-reload';

/** Espera, em ms, antes de cada nova tentativa (3 tentativas no total). */
const RETRY_DELAYS_MS = [200, 800];

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const retryImport = async <T>(
  loader: () => Promise<T>,
  delays: readonly number[] = RETRY_DELAYS_MS
): Promise<T> => {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      if (attempt >= delays.length || !isChunkLoadError(error)) throw error;
      await wait(delays[attempt]);
    }
  }
};

/** `React.lazy` que volta a tentar quando o ficheiro da página falha ao carregar. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo tipo que o `lazy` do React
export const lazyRetry = <T extends ComponentType<any>>(loader: () => Promise<{ default: T }>) =>
  lazy(() => retryImport(loader));
