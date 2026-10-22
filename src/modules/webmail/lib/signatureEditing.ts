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

const MAX_BYTES = 1024 * 1024;
const MAX_SIDE = 900;

/**
 * As imagens da assinatura têm 1 MB de limite: as maiores são reduzidas (até 900 px de lado)
 * antes de enviar. GIFs animados ficam como estão.
 */
export const prepareSignatureImage = async (file: File): Promise<File> => {
  if (file.type === 'image/gif' || (file.size <= MAX_BYTES / 2 && file.size < 400 * 1024))
    return file;
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
