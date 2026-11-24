import { Suspense } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { lazyRetry, retryImport } from '../lazy-retry';

const chunkError = () =>
  new TypeError(
    'Failed to fetch dynamically imported module: https://app.realizeconsultadoria.pt/a2/OpenFilesHost-C72gEGdk.js'
  );

describe('retryImport', () => {
  it('devolve o módulo à primeira, sem esperar', async () => {
    const loader = vi.fn().mockResolvedValue({ default: 'ok' });
    await expect(retryImport(loader, [0, 0])).resolves.toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('volta a tentar quando o ficheiro falha e acaba por carregar', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(chunkError())
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: 'ok' });
    await expect(retryImport(loader, [0, 0])).resolves.toEqual({ default: 'ok' });
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('desiste depois de esgotar as tentativas e devolve o erro original', async () => {
    const error = chunkError();
    const loader = vi.fn().mockRejectedValue(error);
    await expect(retryImport(loader, [0, 0])).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(3);
  });

  it('não repete erros que não são de carregamento de ficheiros', async () => {
    const error = new Error('Cannot read properties of undefined');
    const loader = vi.fn().mockRejectedValue(error);
    await expect(retryImport(loader, [0, 0])).rejects.toBe(error);
    expect(loader).toHaveBeenCalledTimes(1);
  });
});

describe('lazyRetry', () => {
  it('mostra a página depois de um carregamento falhado, sem ecrã de erro', async () => {
    const loader = vi
      .fn()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: () => <p>Página aberta</p> });
    const Page = lazyRetry(loader);
    render(
      <Suspense fallback={<p>A carregar</p>}>
        <Page />
      </Suspense>
    );
    expect(await screen.findByText('Página aberta', {}, { timeout: 3000 })).toBeTruthy();
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
