import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LOGO_MAX_INPUT_BYTES,
  LogoError,
  fitWithin,
  logoErrorText,
  prepareLogo,
  validateLogoFile,
} from '../logoImage';

describe('validateLogoFile', () => {
  it('aceita PNG, JPG, WebP e SVG dentro do limite', () => {
    for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']) {
      expect(validateLogoFile({ type, size: 1000 })).toBeNull();
    }
  });

  it('recusa outros tipos (GIF, PDF, HTML)', () => {
    for (const type of ['image/gif', 'application/pdf', 'text/html', '']) {
      expect(validateLogoFile({ type, size: 1000 })?.code).toBe('type');
    }
  });

  it('recusa o que passa de 5 MB e aceita exatamente 5 MB', () => {
    expect(validateLogoFile({ type: 'image/png', size: LOGO_MAX_INPUT_BYTES + 1 })?.code).toBe(
      'size'
    );
    expect(validateLogoFile({ type: 'image/png', size: LOGO_MAX_INPUT_BYTES })).toBeNull();
  });
});

describe('fitWithin', () => {
  it('reduz mantendo a proporção', () => {
    expect(fitWithin(2000, 1000)).toEqual({ width: 512, height: 256 });
    expect(fitWithin(1000, 2000)).toEqual({ width: 256, height: 512 });
  });

  it('nunca aumenta uma imagem pequena', () => {
    expect(fitWithin(100, 40)).toEqual({ width: 100, height: 40 });
  });

  it('um SVG sem tamanho próprio usa o máximo', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 512, height: 512 });
  });

  it('nunca devolve zero', () => {
    expect(fitWithin(10000, 1)).toEqual({ width: 512, height: 1 });
  });
});

describe('logoErrorText', () => {
  it('traduz o código para português e nunca mostra o código', () => {
    expect(logoErrorText(new LogoError('type'))).toMatch(/PNG, JPG, WebP ou SVG/);
    expect(logoErrorText(new LogoError('size'))).toMatch(/5 MB/);
    expect(logoErrorText(new LogoError('pixels'))).toMatch(/dimensões grandes demais/);
    expect(logoErrorText(new Error('x'))).toMatch(/Não foi possível ler/);
  });
});

describe('prepareLogo — dimensões', () => {
  afterEach(() => vi.unstubAllGlobals());

  const stubImage = (naturalWidth: number, naturalHeight: number) => {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = naturalWidth;
        naturalHeight = naturalHeight;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_value: string) {
          queueMicrotask(() => this.onload?.());
        }
      }
    );
    URL.createObjectURL = vi.fn(() => 'blob:teste');
    URL.revokeObjectURL = vi.fn();
  };

  it('recusa uma imagem com mais de 40 milhões de píxeis, sem a desenhar', async () => {
    stubImage(8000, 5001);
    const createCanvas = vi.spyOn(document, 'createElement');
    const file = new File(['x'], 'grande.png', { type: 'image/png' });
    await expect(prepareLogo(file)).rejects.toMatchObject({ code: 'pixels' });
    expect(createCanvas).not.toHaveBeenCalledWith('canvas');
    createCanvas.mockRestore();
  });
});
