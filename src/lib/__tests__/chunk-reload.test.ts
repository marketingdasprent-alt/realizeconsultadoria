import { afterEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError, reloadForNewVersion } from '../chunk-reload';

describe('versão nova com a app aberta', () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('reconhece os erros de ficheiros da versão anterior', () => {
    expect(
      isChunkLoadError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://app.realizeconsultadoria.pt/assets/TasksPage-fUMPM01Z.js'
        )
      )
    ).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  it('recarrega uma vez e não entra em ciclo', () => {
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({
      ...window.location,
      reload,
    } as Location);
    expect(reloadForNewVersion()).toBe(true);
    expect(reloadForNewVersion()).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
