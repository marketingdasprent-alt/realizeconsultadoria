import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LOGO_MAX_INPUT_BYTES,
  LOGO_MAX_OUTPUT_BYTES,
  LogoError,
  fitWithin,
  logoErrorText,
  prepareLogo,
  validateLogoFile,
} from '../logoImage';

const fileOf = (type: string) => new File([new Uint8Array(16)], 'logo', { type });

describe('logoImage: casos de fronteira', () => {
  it('o tipo é verificado antes do tamanho', () => {
    const error = validateLogoFile({ type: 'image/gif', size: LOGO_MAX_INPUT_BYTES * 2 });
    expect(error?.code).toBe('type');
  });

  it('aceita um ficheiro vazio (o conteúdo só se vê ao desenhar)', () => {
    expect(validateLogoFile({ type: 'image/png', size: 0 })).toBeNull();
  });

  it.each([
    ['encode', 'Não foi possível preparar a imagem. Experimente outro ficheiro.'],
    ['too_big', 'A imagem continua grande demais depois de reduzida. Experimente outro ficheiro.'],
    ['decode', 'Não foi possível ler esta imagem. Experimente outro ficheiro.'],
  ] as const)('o código %s tem texto em português', (code, text) => {
    expect(logoErrorText(new LogoError(code))).toBe(text);
  });

  it('o LogoError guarda o código e o nome', () => {
    const error = new LogoError('size');
    expect(error.code).toBe('size');
    expect(error.name).toBe('LogoError');
    expect(error).toBeInstanceOf(Error);
  });

  it.each([
    [-5, 10],
    [10, 0],
    [Number.NaN, 10],
  ])('dimensões inválidas (%s x %s) dão o quadrado do máximo', (width, height) => {
    expect(fitWithin(width, height)).toEqual({ width: 512, height: 512 });
  });

  it('respeita um máximo diferente', () => {
    expect(fitWithin(400, 200, 100)).toEqual({ width: 100, height: 50 });
  });
});

describe('prepareLogo', () => {
  const createObjectURL = vi.fn(() => 'blob:fake');
  const revokeObjectURL = vi.fn();
  const drawImage = vi.fn();
  let imageSize = { naturalWidth: 1024, naturalHeight: 512 };
  let imageFails = false;
  let hasContext = true;
  /** O que a tela devolve por tipo pedido; ausente simula um tipo sem suporte. */
  let encoded: Record<string, Blob | null> = {};
  const requestedTypes: string[] = [];

  class FakeImage {
    naturalWidth = 0;
    naturalHeight = 0;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        if (imageFails) return this.onerror?.();
        this.naturalWidth = imageSize.naturalWidth;
        this.naturalHeight = imageSize.naturalHeight;
        this.onload?.();
      });
    }
  }

  const blobOf = (type: string, size = 100) => {
    const blob = new Blob([new Uint8Array(8)], { type });
    Object.defineProperty(blob, 'size', { value: size });
    return blob;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    imageSize = { naturalWidth: 1024, naturalHeight: 512 };
    imageFails = false;
    hasContext = true;
    requestedTypes.length = 0;
    encoded = { 'image/webp': blobOf('image/webp'), 'image/png': blobOf('image/png') };
    vi.stubGlobal('Image', FakeImage);
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() =>
      hasContext ? { drawImage } : null) as unknown as HTMLCanvasElement['getContext']);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, type) {
      requestedTypes.push(type ?? '');
      callback(encoded[type ?? ''] ?? null);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('recusa o tipo sem chegar a ler a imagem', async () => {
    await expect(prepareLogo(fileOf('image/gif'))).rejects.toMatchObject({ code: 'type' });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('recusa um ficheiro demasiado grande sem chegar a ler a imagem', async () => {
    const big = fileOf('image/png');
    Object.defineProperty(big, 'size', { value: LOGO_MAX_INPUT_BYTES + 1 });
    await expect(prepareLogo(big)).rejects.toMatchObject({ code: 'size' });
    expect(createObjectURL).not.toHaveBeenCalled();
  });

  it('um PNG sai em WebP, reduzido a 512 px, e liberta o endereço temporário', async () => {
    const result = await prepareLogo(fileOf('image/png'));
    expect(result.ext).toBe('webp');
    expect(result.blob.type).toBe('image/webp');
    expect(requestedTypes).toEqual(['image/webp']);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 512, 256);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('uma imagem pequena não é aumentada', async () => {
    imageSize = { naturalWidth: 64, naturalHeight: 32 };
    await prepareLogo(fileOf('image/jpeg'));
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 64, 32);
  });

  it('um SVG nunca segue tal como veio: é desenhado e sai em PNG, sem tentar WebP', async () => {
    const result = await prepareLogo(fileOf('image/svg+xml'));
    expect(result.ext).toBe('png');
    expect(result.blob.type).toBe('image/png');
    expect(requestedTypes).toEqual(['image/png']);
  });

  it('sem suporte a WebP no navegador (devolve PNG) a extensão acompanha o tipo real', async () => {
    encoded = { 'image/webp': blobOf('image/png'), 'image/png': blobOf('image/png') };
    const result = await prepareLogo(fileOf('image/png'));
    expect(requestedTypes).toEqual(['image/webp', 'image/png']);
    expect(result.ext).toBe('png');
  });

  it('se a tela devolve null para WebP tenta PNG', async () => {
    encoded = { 'image/webp': null, 'image/png': blobOf('image/png') };
    const result = await prepareLogo(fileOf('image/webp'));
    expect(result.ext).toBe('png');
  });

  it('imagem ilegível dá erro de leitura e liberta o endereço temporário', async () => {
    imageFails = true;
    await expect(prepareLogo(fileOf('image/png'))).rejects.toMatchObject({ code: 'decode' });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('sem contexto 2D dá erro de preparação', async () => {
    hasContext = false;
    await expect(prepareLogo(fileOf('image/png'))).rejects.toMatchObject({ code: 'encode' });
  });

  it('se nem o PNG se consegue produzir dá erro de preparação', async () => {
    encoded = {};
    await expect(prepareLogo(fileOf('image/png'))).rejects.toMatchObject({ code: 'encode' });
  });

  it('aceita um resultado exatamente no limite de 1 MB', async () => {
    encoded = { 'image/webp': blobOf('image/webp', LOGO_MAX_OUTPUT_BYTES) };
    const result = await prepareLogo(fileOf('image/png'));
    expect(result.ext).toBe('webp');
  });

  it('recusa um resultado acima de 1 MB depois de reduzido', async () => {
    encoded = { 'image/webp': blobOf('image/webp', LOGO_MAX_OUTPUT_BYTES + 1) };
    await expect(prepareLogo(fileOf('image/png'))).rejects.toMatchObject({ code: 'too_big' });
  });
});
