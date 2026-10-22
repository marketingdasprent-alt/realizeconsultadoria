// Miniatura de um PDF: a primeira página desenhada numa imagem (o pdf.js só carrega quando há
// um PDF para mostrar; o visualizador do navegador não desenha em miniaturas pequenas).
type PdfJs = typeof import('pdfjs-dist');

let loading: Promise<PdfJs> | null = null;

const loadPdfJs = (): Promise<PdfJs> =>
  (loading ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  }));

/** A primeira página como imagem (data URL JPEG) com `width` píxeis de largura. */
export const pdfFirstPage = async (blob: Blob, width = 240): Promise<string> => {
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    void task.destroy();
  }
};
