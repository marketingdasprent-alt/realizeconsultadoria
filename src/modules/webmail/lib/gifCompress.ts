// Comprimir GIFs animados da assinatura no próprio browser, sem perder a animação:
// reduz a largura (até ao dobro do que aparece no email, por isso continua nítido) e grava
// cada quadro só com o que mudou (o resto fica transparente e a imagem anterior mantém-se).
import { decompressFrames, parseGIF } from 'gifuct-js';
import { applyPalette, GIFEncoder, quantize } from 'gifenc';

/** Diferença máxima (soma de R, G e B) para um ponto contar como "igual ao quadro anterior". */
const SAME_COLOR = 24;

/**
 * Pontos que não mudaram desde o quadro anterior passam a transparentes (o visualizador mantém
 * o que lá estava). `shown` é o que se vê no ecrã, em RGB, e é atualizado aqui.
 */
export const markUnchanged = (
  index: Uint8Array,
  palette: number[][],
  shown: Uint8Array,
  transparentIndex: number,
  first: boolean
) => {
  for (let i = 0; i < index.length; i += 1) {
    const color = palette[index[i]];
    const at = i * 3;
    const diff =
      Math.abs(color[0] - shown[at]) +
      Math.abs(color[1] - shown[at + 1]) +
      Math.abs(color[2] - shown[at + 2]);
    if (!first && diff <= SAME_COLOR) {
      index[i] = transparentIndex;
    } else {
      shown[at] = color[0];
      shown[at + 1] = color[1];
      shown[at + 2] = color[2];
    }
  }
};

const canvas = (width: number, height: number) => {
  const element = document.createElement('canvas');
  element.width = width;
  element.height = height;
  const context = element.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Sem canvas');
  return { element, context };
};

/**
 * GIF animado mais leve, com a mesma animação e tempos. Fundo transparente fica branco (o fundo
 * dos emails). Devolve null se não conseguir ler o GIF.
 */
export const compressGif = async (file: File, maxWidth: number): Promise<File | null> => {
  try {
    const gif = parseGIF(await file.arrayBuffer());
    const frames = decompressFrames(gif, true);
    const { width, height } = gif.lsd;
    if (!frames.length || !width || !height) return null;
    const scale = Math.min(1, maxWidth / width);
    const outWidth = Math.max(1, Math.round(width * scale));
    const outHeight = Math.max(1, Math.round(height * scale));

    // O GIF completo, quadro a quadro (os quadros do original podem ser só um pedaço).
    const full = canvas(width, height);
    full.context.fillStyle = '#ffffff';
    full.context.fillRect(0, 0, width, height);
    const out = canvas(outWidth, outHeight);
    out.context.imageSmoothingQuality = 'high';
    const shown = new Uint8Array(outWidth * outHeight * 3);
    const encoder = GIFEncoder();

    let previous: (typeof frames)[number] | null = null;
    let restore: ImageData | null = null;
    for (const [n, frame] of frames.entries()) {
      // O que o quadro anterior pediu para fazer depois de mostrado.
      if (previous?.disposalType === 2) {
        const { left, top, width: w, height: h } = previous.dims;
        full.context.fillRect(left, top, w, h);
      } else if (previous?.disposalType === 3 && restore) {
        full.context.putImageData(restore, 0, 0);
      }
      restore = frame.disposalType === 3 ? full.context.getImageData(0, 0, width, height) : null;

      const patch = canvas(frame.dims.width, frame.dims.height);
      patch.context.putImageData(
        new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height),
        0,
        0
      );
      full.context.drawImage(patch.element, frame.dims.left, frame.dims.top);

      out.context.drawImage(full.element, 0, 0, outWidth, outHeight);
      const { data } = out.context.getImageData(0, 0, outWidth, outHeight);
      const palette = quantize(data, 255);
      const index = applyPalette(data, palette);
      const transparentIndex = palette.length;
      markUnchanged(index, palette, shown, transparentIndex, n === 0);
      encoder.writeFrame(index, outWidth, outHeight, {
        palette: [...palette, [255, 0, 255]],
        delay: frame.delay,
        transparent: n > 0,
        transparentIndex,
        dispose: 1,
      });
      previous = frame;
    }
    encoder.finish();
    return new File([encoder.bytes()], file.name.replace(/\.[^.]+$/, '') + '.gif', {
      type: 'image/gif',
    });
  } catch {
    return null;
  }
};
