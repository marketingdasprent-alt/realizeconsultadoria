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
  // Documentos de texto, código e compactados do dia a dia, e vídeos curtos.
  'text/markdown',
  'application/json',
  'application/xml',
  'text/xml',
  'application/vnd.rar',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'video/mp4',
  'video/quicktime',
  'application/rtf',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
]);

/** Valor do atributo accept do seletor de ficheiros. */
// Também pela extensão: o Windows nem sempre dá tipo a .md, .json, .rar, .7z…
export const ACCEPT_ATTRIBUTE = [
  ...[...ALLOWED_MIME].filter(m => !m.startsWith('audio/')),
  ...['.md', '.markdown', '.json', '.xml', '.log', '.txt', '.rar', '.7z', '.zip'],
  ...['.mp4', '.mov', '.rtf', '.odt', '.ods', '.csv', '.heic'],
].join(',');

/** "audio/webm;codecs=opus" → "audio/webm". */
export const baseMime = (mime: string): string => mime.split(';')[0].trim().toLowerCase();

// Nomes alternativos que alguns sistemas dão aos mesmos formatos (ex.: o ZIP do Windows).
const MIME_ALIASES: Record<string, string> = {
  'application/x-zip-compressed': 'application/zip',
  'application/x-zip': 'application/zip',
  'text/x-markdown': 'text/markdown',
  'application/x-rar': 'application/vnd.rar',
  'application/x-7z': 'application/x-7z-compressed',
  'image/jpg': 'image/jpeg',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/x-m4a': 'audio/mp4',
  'audio/mp3': 'audio/mpeg',
};

// Tipo pela extensão, para ficheiros que chegam sem tipo (comum no Windows).
const BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  xml: 'application/xml',
  log: 'text/plain',
  rar: 'application/vnd.rar',
  '7z': 'application/x-7z-compressed',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  rtf: 'application/rtf',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};

/** Tipo do ficheiro já normalizado (alias e, sem tipo, pela extensão do nome). */
export const normalizeMime = (mime: string, fileName = ''): string => {
  const base = baseMime(mime || '');
  if (base && base !== 'application/octet-stream') return MIME_ALIASES[base] ?? base;
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? (base || 'application/octet-stream');
};

export const extensionFor = (mime: string): string =>
  ({ 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3' })[
    baseMime(mime)
  ] ?? 'bin';

// Nunca se enviam programas nem ficheiros de configuração com segredos (.env).
const BLOCKED =
  /(^\.env(\..*)?$)|\.(exe|msi|bat|cmd|com|scr|ps1|vbs|vbe|jse|wsf|hta|cpl|jar|reg|lnk|sh)$/i;

/** Mensagem de erro para um ficheiro que não pode ser enviado, ou null se estiver bem. */
export const validateFile = (size: number, mime: string, name = ''): string | null => {
  if (size > MAX_FILE_BYTES) return 'O ficheiro tem mais de 25 MB.';
  if (BLOCKED.test(name.trim()))
    return 'Por segurança, programas e ficheiros .env (com palavras-passe) não se enviam aqui.';
  if (!ALLOWED_MIME.has(baseMime(mime)))
    return 'Este tipo de ficheiro não é suportado. Envie-o num ZIP.';
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
