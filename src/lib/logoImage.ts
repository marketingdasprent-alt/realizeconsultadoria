// Logo da empresa: valida o ficheiro e recodifica-o no navegador antes de o enviar. A imagem sai
// sempre em WebP (ou PNG, no caso de um SVG) com 512 px no máximo: tira os metadados e, sobretudo,
// nunca segue um SVG tal como veio (pode trazer scripts); é desenhado e só os pixéis são enviados.

export const LOGO_MAX_SIDE = 512;
/** O que se aceita escolher; o bucket só guarda o resultado já recodificado. */
export const LOGO_MAX_INPUT_BYTES = 5 * 1024 * 1024;
/** O limite do bucket company-logos. */
export const LOGO_MAX_OUTPUT_BYTES = 1024 * 1024;
export const LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'] as const;

export type LogoErrorCode = 'type' | 'size' | 'decode' | 'encode' | 'too_big';

export class LogoError extends Error {
  readonly code: LogoErrorCode;
  constructor(code: LogoErrorCode) {
    super(code);
    this.name = 'LogoError';
    this.code = code;
  }
}

const LOGO_ERROR_TEXT: Record<LogoErrorCode, string> = {
  type: 'Use uma imagem PNG, JPG, WebP ou SVG.',
  size: 'A imagem é grande demais. O máximo são 5 MB.',
  decode: 'Não foi possível ler esta imagem. Experimente outro ficheiro.',
  encode: 'Não foi possível preparar a imagem. Experimente outro ficheiro.',
  too_big: 'A imagem continua grande demais depois de reduzida. Experimente outro ficheiro.',
};

export const logoErrorText = (error: unknown): string =>
  error instanceof LogoError ? LOGO_ERROR_TEXT[error.code] : LOGO_ERROR_TEXT.decode;

/** O ficheiro escolhido serve? (tipo e tamanho; o conteúdo só se vê ao desenhar). */
export const validateLogoFile = (file: Pick<File, 'type' | 'size'>): LogoError | null => {
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) return new LogoError('type');
  if (file.size > LOGO_MAX_INPUT_BYTES) return new LogoError('size');
  return null;
};

/** Cabe a imagem em `max` x `max` mantendo a proporção; nunca a aumenta. */
export const fitWithin = (
  width: number,
  height: number,
  max: number = LOGO_MAX_SIDE
): { width: number; height: number } => {
  if (!(width > 0) || !(height > 0)) return { width: max, height: max };
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

export interface PreparedLogo {
  blob: Blob;
  ext: 'webp' | 'png';
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new LogoError('decode'));
    };
    image.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> =>
  new Promise(resolve => canvas.toBlob(resolve, type, quality));

/** Valida, desenha numa tela até 512 px e devolve o ficheiro a enviar (WebP, ou PNG para SVG). */
export const prepareLogo = async (file: File): Promise<PreparedLogo> => {
  const invalid = validateLogoFile(file);
  if (invalid) throw invalid;
  const image = await loadImage(file);
  const isSvg = file.type === 'image/svg+xml';
  const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new LogoError('encode');
  context.drawImage(image, 0, 0, width, height);

  let blob = isSvg ? null : await toBlob(canvas, 'image/webp', 0.9);
  let ext: PreparedLogo['ext'] = 'webp';
  // Sem suporte a WebP o navegador devolve PNG: a extensão acompanha o tipo real.
  if (!blob || blob.type !== 'image/webp') {
    blob = await toBlob(canvas, 'image/png');
    ext = 'png';
  }
  if (!blob) throw new LogoError('encode');
  if (blob.size > LOGO_MAX_OUTPUT_BYTES) throw new LogoError('too_big');
  return { blob, ext };
};
