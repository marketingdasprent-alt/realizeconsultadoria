// Ajudas do editor de assinaturas: largar imagens no sítio certo e reduzir as que são grandes.

type CaretDocument = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
  caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
};

/** O ponto do texto que está debaixo do rato (para largar a imagem aí). */
export const caretRangeAt = (x: number, y: number): Range | null => {
  const doc = document as CaretDocument;
  if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
  const position = doc.caretPositionFromPoint?.(x, y);
  if (!position) return null;
  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
};

/** Está a arrastar ficheiros (e não texto ou uma imagem do próprio editor)? */
export const dragHasFiles = (transfer: DataTransfer | null): boolean =>
  !!transfer && Array.from(transfer.types).includes('Files');

export const imageFilesOf = (files: FileList | File[] | null | undefined): File[] =>
  Array.from(files ?? []).filter(file => file.type.startsWith('image/'));

/**
 * Largura máxima a que uma imagem aparece no email (a largura habitual de um email).
 * O ficheiro guarda o dobro dos pontos: fica nítido nos ecrãs de alta resolução.
 */
export const SIGNATURE_MAX_WIDTH = 600;
const MAX_SIDE = SIGNATURE_MAX_WIDTH * 2;

/**
 * Largura a que a imagem aparece ao entrar na assinatura: a "Largura do email" (600 px),
 * o tamanho que fica bem nas assinaturas em imagem. As mais pequenas que isso ficam como são.
 */
export const defaultSignatureWidth = (naturalWidth: number): number =>
  Math.round(Math.min(SIGNATURE_MAX_WIDTH, naturalWidth));

/**
 * Põe a largura na imagem de forma que todos os programas de email respeitem: o atributo
 * (Outlook) e o estilo com max-width (Gmail e telemóveis encolhem-na para caber no ecrã).
 * Sem largura: o tamanho real, mas nunca mais larga que o ecrã.
 */
export const applySignatureWidth = (image: HTMLImageElement, width: number | null) => {
  image.removeAttribute('height');
  if (width) {
    image.setAttribute('width', String(width));
    image.setAttribute('style', `width:${width}px;max-width:100%;height:auto`);
  } else {
    image.removeAttribute('width');
    image.setAttribute('style', 'max-width:100%;height:auto');
  }
};

/** Largura real da imagem, em pontos (0 se não se conseguir ler). */
export const naturalWidthOf = async (file: File): Promise<number> => {
  try {
    const bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    bitmap.close();
    return width;
  } catch {
    return 0;
  }
};

/**
 * GIF acima de 1 MB: fica animado como está, mas demora a abrir e alguns programas de email
 * podem não o mostrar; avisa-se a pessoa.
 */
export const isHeavyGif = (file: File) => file.type === 'image/gif' && file.size > 1024 * 1024;

/**
 * As imagens da assinatura têm 5 MB de limite; as acima de 400 KB são reduzidas (até 1200 px,
 * o dobro do que aparece) antes de enviar para o email não pesar. GIFs pesados são comprimidos
 * mantendo a animação (gifCompress); fica o mais leve dos dois.
 */
export const prepareSignatureImage = async (file: File): Promise<File> => {
  if (file.type === 'image/gif') {
    if (!isHeavyGif(file)) return file;
    // Só se carrega o compressor quando é preciso (não pesa no resto da app).
    const { compressGif } = await import('./gifCompress');
    const compressed = await compressGif(file, MAX_SIDE);
    return compressed && compressed.size < file.size ? compressed : file;
  }
  if (file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // JPG fica JPG; o resto fica PNG (mantém transparência).
    const type = file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, 0.88));
    if (!blob || blob.size >= file.size) return file;
    const extension = type === 'image/jpeg' ? 'jpg' : 'png';
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + `.${extension}`, { type });
  } catch {
    return file;
  }
};
