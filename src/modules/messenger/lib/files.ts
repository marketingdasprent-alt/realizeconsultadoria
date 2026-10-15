// Regras dos anexos do Messenger (iguais às do bucket chat-files na BD).

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
]);

/** Valor do atributo accept do seletor de ficheiros. */
export const ACCEPT_ATTRIBUTE = [...ALLOWED_MIME].filter(m => !m.startsWith('audio/')).join(',');

/** "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (mime: string): string => mime.split(';')[0].trim().toLowerCase();

export const extensionFor = (mime: string): string =>
  ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' })[
    baseMime(mime)
  ] ?? 'bin';

/** Mensagem de erro para um ficheiro que não pode ser enviado, ou null se estiver bem. */
export const validateFile = (size: number, mime: string): string | null => {
  if (size > MAX_FILE_BYTES) return 'O ficheiro tem mais de 25 MB.';
  if (!ALLOWED_MIME.has(baseMime(mime))) return 'Este tipo de ficheiro não é suportado.';
  return null;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
};

/** Rótulo curto do tipo de ficheiro (PDF, Word, Excel…). */
export const fileTypeLabel = (mime: string, name: string): string => {
  const m = baseMime(mime);
  if (m === 'application/pdf') return 'PDF';
  if (m.includes('word')) return 'Word';
  if (m.includes('excel') || m.includes('spreadsheet')) return 'Excel';
  if (m.includes('powerpoint') || m.includes('presentation')) return 'PowerPoint';
  if (m.startsWith('image/')) return 'Imagem';
  return name.split('.').pop()?.toUpperCase() ?? 'Ficheiro';
};
