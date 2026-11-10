// Imagens da assinatura mais leves: vão em cada email enviado (embebidas), por isso uma imagem
// de 1–2 MB tornava cada email pesado e o leitor deixava de a mostrar nos Enviados.

/** Largura máxima guardada: o dobro dos 600 px de uma assinatura típica (ecrãs retina). */
export const SIGNATURE_MAX_WIDTH = 1200;
/** Abaixo disto a imagem fica como está. */
const SMALL_ENOUGH = 200 * 1024;

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });

const hasTransparency = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  const data = ctx.getImageData(0, 0, width, height).data;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 250) return true;
  return false;
};

/**
 * Reduz para no máx. 1200 px de largura e volta a gravar: JPG (qualidade alta) se não tiver
 * transparência, PNG se tiver. GIF (pode ser animado) e imagens já leves ficam iguais; se o
 * resultado não ficar mais pequeno, usa-se o original.
 */
export const shrinkSignatureImage = async (file: File): Promise<File> => {
  if (file.type === 'image/gif' || file.size <= SMALL_ENOUGH) return file;
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, SIGNATURE_MAX_WIDTH / img.naturalWidth);
    const width = Math.max(1, Math.round(img.naturalWidth * scale));
    const height = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, width, height);
    const transparent = hasTransparency(ctx, width, height);
    const type = transparent ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, type, transparent ? undefined : 0.9)
    );
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, '') + (transparent ? '.png' : '.jpg');
    return new File([blob], name, { type });
  } catch {
    return file;
  }
};
