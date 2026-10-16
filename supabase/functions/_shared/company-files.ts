// Regras dos Documentos da empresa (partilhadas entre a edge function `company-files`, a
// página Documentos e os testes Vitest). Sem dependências de Deno/Node.
//
// Os ficheiros estão no SRVDC (D:\Shares) e são servidos por um agente de ficheiros:
//   * as edge functions falam com ele pelo túnel (files.dasprent.pt);
//   * o ONLYOFFICE, no próprio servidor, descarrega e grava pelo endereço local (127.0.0.1),
//     que o browser nunca vê.
// Caminhos relativos, com "/" e sem barra no início ou no fim ("RAIZ/sub/ficheiro.docx"),
// com os nomes exatamente como o agente os devolve.

export type FolderPermission = 'read' | 'edit';
export type AgentOp = 'list' | 'download' | 'mkdir' | 'callback';
export type OnlyOfficeDocumentType = 'word' | 'cell' | 'slide' | 'pdf';
export type EditorMode = 'edit' | 'view';

export interface FolderAssignment {
  path: string;
  permission: FolderPermission;
}

const BACKSLASH = String.fromCharCode(92);
/** Caracteres que o Windows não aceita em nomes. */
const INVALID_NAME_CHARS = `<>:"|?*/${BACKSLASH}`;

/** Um nome de ficheiro ou pasta aceite pelo agente (sem "." / "..", sem espaço ou ponto no fim). */
export const isValidName = (name: string): boolean =>
  name.length > 0 &&
  name.length <= 255 &&
  name !== '.' &&
  name !== '..' &&
  !/[ .]$/.test(name) &&
  ![...name].some(ch => ch.charCodeAt(0) < 32 || INVALID_NAME_CHARS.includes(ch));

/** Valida um caminho relativo vindo do browser; devolve null se for inválido ou vazio. */
export const cleanPath = (raw: unknown): string | null => {
  if (typeof raw !== 'string' || raw === '' || raw.length > 1024) return null;
  return raw.split('/').every(isValidName) ? raw : null;
};

/** Permissão num caminho: a melhor das pastas atribuídas que o contêm (ou null). */
export const accessFor = (
  path: string,
  assignments: FolderAssignment[]
): FolderPermission | null => {
  let best: FolderPermission | null = null;
  for (const folder of assignments) {
    if (path !== folder.path && !path.startsWith(`${folder.path}/`)) continue;
    if (folder.permission === 'edit') return 'edit';
    best = 'read';
  }
  return best;
};

export const parentPath = (path: string): string =>
  path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

export const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1);

export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const DOCUMENT_TYPES: Record<OnlyOfficeDocumentType, string[]> = {
  word: ['doc', 'docm', 'docx', 'dot', 'dotm', 'dotx', 'epub', 'fodt', 'odt', 'ott', 'rtf', 'txt'],
  cell: ['csv', 'fods', 'ods', 'ots', 'xls', 'xlsb', 'xlsm', 'xlsx', 'xlt', 'xltm', 'xltx'],
  slide: [
    'fodp',
    'odp',
    'otp',
    'pot',
    'potm',
    'potx',
    'pps',
    'ppsm',
    'ppsx',
    'ppt',
    'pptm',
    'pptx',
  ],
  pdf: ['pdf', 'djvu', 'xps', 'oxps'],
};

/** Tipo de editor do ONLYOFFICE para uma extensão (null = não abre no editor). */
export const documentTypeFor = (extension: string): OnlyOfficeDocumentType | null =>
  (Object.keys(DOCUMENT_TYPES) as OnlyOfficeDocumentType[]).find(type =>
    DOCUMENT_TYPES[type].includes(extension)
  ) ?? null;

/**
 * Formatos que o ONLYOFFICE grava no mesmo formato. Os antigos (.doc, .xls, .odt…) voltam
 * convertidos e o agente recusa gravá-los, por isso abrem só para ver.
 */
const EDITABLE_EXTENSIONS = ['docx', 'xlsx', 'pptx', 'pdf'];

export const editorModeFor = (extension: string, permission: FolderPermission): EditorMode =>
  permission === 'edit' && EDITABLE_EXTENSIONS.includes(extension) ? 'edit' : 'view';

const toHex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');

/** document.key do ONLYOFFICE: muda sempre que o ficheiro muda (caminho + data + tamanho). */
export const documentKey = async (path: string, modified: string, size?: number) =>
  toHex(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${path}|${modified}|${size ?? ''}`)
    )
  );

const base64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** JWT HS256, como o pedem o agente de ficheiros e o ONLYOFFICE. */
export const signJwt = async (payload: object, secret: string): Promise<string> => {
  const encoder = new TextEncoder();
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${base64Url(new Uint8Array(signature))}`;
};

/** Token do agente: só vale para esta operação, neste caminho, até `exp`. */
export const agentToken = (op: AgentOp, path: string, ttlSeconds: number, secret: string) =>
  signJwt({ op, path, exp: Math.floor(Date.now() / 1000) + ttlSeconds }, secret);

export const agentUrl = (base: string, route: string, path: string, token?: string) =>
  `${base}${route}?path=${encodeURIComponent(path)}${
    token ? `&token=${encodeURIComponent(token)}` : ''
  }`;

export interface EditorConfigInput {
  path: string;
  modified: string;
  size?: number;
  mode: EditorMode;
  documentType: OnlyOfficeDocumentType;
  user: { id: string; name: string };
  /** Endereço do agente visto pelo ONLYOFFICE (http://127.0.0.1:8181). */
  localAgentUrl: string;
  downloadToken: string;
  callbackToken: string;
}

/** Config do DocsAPI.DocEditor (sem o "token", que é esta config assinada). */
export const buildEditorConfig = async (input: EditorConfigInput) => {
  const name = baseName(input.path);
  return {
    documentType: input.documentType,
    document: {
      fileType: extensionOf(name),
      key: await documentKey(input.path, input.modified, input.size),
      title: name,
      url: agentUrl(input.localAgentUrl, '/api/file', input.path, input.downloadToken),
      permissions: { edit: input.mode === 'edit', download: true, print: true },
    },
    editorConfig: {
      mode: input.mode,
      lang: 'pt-PT',
      region: 'pt-PT',
      user: input.user,
      callbackUrl: agentUrl(
        input.localAgentUrl,
        '/onlyoffice/callback',
        input.path,
        input.callbackToken
      ),
      // "Guardar" grava logo em D:\Shares (callback com status 6), sem esperar que todos fechem
      customization: { forcesave: true },
    },
  };
};
