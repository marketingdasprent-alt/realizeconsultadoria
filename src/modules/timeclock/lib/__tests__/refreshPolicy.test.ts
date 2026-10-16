import { describe, expect, it } from 'vitest';
import { shouldRefreshOnVisible, VISIBLE_REFRESH_MS } from '../refreshPolicy';

describe('ponto: recarregar ao voltar à app', () => {
  const loaded = 1_000_000;

  it('não recarrega logo a seguir (troca de separador)', () => {
    expect(shouldRefreshOnVisible(loaded, loaded + 30_000, 0)).toBe(false);
  });

  it('recarrega quando já passou o intervalo', () => {
    expect(shouldRefreshOnVisible(loaded, loaded + VISIBLE_REFRESH_MS, 0)).toBe(true);
  });

  it('recarrega se houve um registo noutra janela depois da última carga', () => {
    expect(shouldRefreshOnVisible(loaded, loaded + 20_000, loaded + 10_000)).toBe(true);
    expect(shouldRefreshOnVisible(loaded, loaded + 20_000, loaded - 10_000)).toBe(false);
  });
});
