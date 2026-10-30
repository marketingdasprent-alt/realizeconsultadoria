// Documentos da empresa: pastas do servidor de ficheiros (SRVDC, D:\Shares) abertas no editor
// ONLYOFFICE, só dentro das pastas atribuídas ao colaborador (tabela folder_assignments).
//
// POST { action: 'folders' }         → pastas atribuídas
// POST { action: 'list', path }      → conteúdo de uma pasta
// POST { action: 'open', path }      → config do editor ONLYOFFICE, assinada
// POST { action: 'download', path }  → link de descarga direto do agente (5 min)
// POST { action: 'mkdir', path }     → nova pasta (precisa de permissão de edição)
// POST { action: 'create', path, name, kind } → documento em branco (docx/xlsx/pptx) na pasta
// Só admins (para atribuir pastas aos colaboradores na ficha de cada um):
// POST { action: 'admin-list', path? }  → pastas do servidor (sem path: as raízes)
// POST { action: 'admin-mkdir', path }  → nova pasta (dentro de uma raiz)
// POST { action: 'thumbs', items: [{ path, modified, size }] } → miniaturas (vista em grelha)
// POST { action: 'upload', path, name, size } → link para o browser enviar o ficheiro direto
//                                               ao agente (PUT, 10 min), com um nome livre
//
// Respostas { ok: true, data } ou { ok: false, message }. Os segredos nunca saem daqui: o
// browser só recebe tokens curtos, de uma operação e de um caminho; o document.url e o
// callbackUrl do editor apontam para o agente local (127.0.0.1), que só o ONLYOFFICE alcança.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { corsHeaders, fetchWithTimeout, json, serviceClient } from '../_shared/mail-server/http.ts';
import {
  accessFor,
  agentToken,
  agentUrl,
  baseName,
  buildEditorConfig,
  cleanPath,
  documentTypeFor,
  editorModeFor,
  extensionOf,
  freeName,
  isBlockedUpload,
  isValidName,
  parentPath,
  signJwt,
  type AgentOp,
  type FolderPermission,
  UPLOAD_MAX_BYTES,
} from '../_shared/company-files.ts';
import { BLANK_MIME, blankFile, isBlankKind } from './templates.ts';
import { thumbsFor, type ThumbTarget } from './thumbs.ts';
import { searchFiles, type SearchEntry, type SearchHit } from './search.ts';

const AGENT_URL = Deno.env.get('FILES_AGENT_URL') ?? 'https://files.dasprent.pt';
const LOCAL_AGENT_URL = Deno.env.get('FILES_AGENT_LOCAL_URL') ?? 'http://127.0.0.1:8181';
const ONLYOFFICE_URL = Deno.env.get('ONLYOFFICE_URL') ?? 'https://office.dasprent.pt';

/** Validade dos tokens do agente, em segundos. */
const TTL = {
  request: 60,
  browserDownload: 5 * 60,
  browserUpload: 10 * 60,
  editorDownload: 12 * 3600,
  callback: 48 * 3600,
};

interface CompanyFilesRequest {
  action?:
    | 'folders'
    | 'list'
    | 'open'
    | 'download'
    | 'mkdir'
    | 'create'
    | 'upload'
    | 'admin-list'
    | 'admin-mkdir'
    | 'thumbs'
    | 'search';
  path?: unknown;
  name?: unknown;
  kind?: unknown;
  size?: unknown;
  /** thumbs: [{ path, modified, size }] da listagem da pasta (até 30). */
  items?: unknown;
  /** search: o que procurar no nome dos ficheiros e pastas. */
  query?: unknown;
}

interface AgentEntry {
  name: string;
  type: 'dir' | 'file';
  size?: number;
  modified: string;
}

interface AgentListing {
  entries: AgentEntry[];
  truncated: boolean;
}

const AGENT_ERRORS: Record<number, string> = {
  400: 'Caminho inválido.',
  401: 'O servidor de ficheiros recusou o pedido.',
  403: 'O servidor de ficheiros recusou o pedido.',
  404: 'A pasta ou o ficheiro já não existe.',
  409: 'Já existe uma pasta ou ficheiro com esse nome.',
  413: 'O ficheiro é demasiado grande.',
};

/** Erro com mensagem para o colaborador. */
class FilesError extends Error {
  /** Resposta do agente (código e erro), mostrada só aos admins para diagnóstico. */
  constructor(
    message: string,
    readonly detail?: string
  ) {
    super(message);
  }
}

const ok = (data: unknown) => json({ ok: true, data });
/** `detail`: resposta do agente (código HTTP e erro), para diagnóstico; o ecrã mostra só a mensagem. */
const fail = (message: string, detail?: string) =>
  json({ ok: false, message, ...(detail ? { detail } : {}) });

const READ_ONLY = 'Nesta pasta só tem acesso de leitura.';

/** Pedido ao agente pelo túnel, com um token só para esta operação e caminho. */
const callAgent = async <T>(
  secret: string,
  op: AgentOp,
  route: string,
  path: string,
  file?: { bytes: Uint8Array; type: string }
) => {
  const token = await agentToken(op, path, TTL.request, secret);
  let res: Response;
  try {
    res = await fetchWithTimeout(agentUrl(AGENT_URL, route, path), {
      method: file ? 'PUT' : op === 'mkdir' ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(file ? { 'Content-Type': file.type } : {}),
      },
      // Uint8Array é um corpo válido; os tipos do Deno é que não o aceitam diretamente
      body: file ? (file.bytes as unknown as BodyInit) : undefined,
    });
  } catch {
    throw new FilesError('O servidor de ficheiros não responde. Tente daqui a pouco.');
  }
  const text = await res.text().catch(() => '');
  let body: { error?: unknown } | null = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const detail = `HTTP ${res.status}${body?.error ? `: ${String(body.error)}` : text ? `: ${text.slice(0, 120)}` : ''}`;
    console.error('company-files: agente', route, detail);
    throw new FilesError(
      AGENT_ERRORS[res.status] ?? 'O servidor de ficheiros deu um erro.',
      detail
    );
  }
  return body as T;
};

/**
 * Pesquisa do agente (GET /api/search?path=&q=), só dentro de `path`. Devolve null se o agente
 * ainda não tiver esta rota (404/405/501), para se percorrer as pastas com /api/list.
 */
const agentSearch = async (
  secret: string,
  path: string,
  query: string
): Promise<SearchHit[] | null> => {
  const token = await agentToken('search', path, TTL.request, secret);
  const url = `${AGENT_URL}/api/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(query)}`;
  let res: Response;
  try {
    res = await fetchWithTimeout(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    return null;
  }
  if ([404, 405, 501].includes(res.status)) return null;
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { results?: SearchHit[] } | null;
  return Array.isArray(body?.results) ? body.results : null;
};

/** Raízes de D:\\Shares que o agente serve (se ele não as listar). */
const ROOTS = (Deno.env.get('FILES_ROOTS') ?? 'DASPRENT,RAZÃO DINÂMICA LDA,_SAAS_TESTE')
  .split(',')
  .map(name => name.trim())
  .filter(Boolean);

/**
 * Explorador do admin: vê todas as pastas do servidor (não só as atribuídas a ele) e cria
 * pastas novas, para as atribuir na ficha de cada colaborador. Só pastas, sem ficheiros.
 */
const adminAction = async (
  db: ReturnType<typeof serviceClient>,
  userId: string,
  body: CompanyFilesRequest,
  secret: string
) => {
  const { data: isAdmin } = await db.rpc('has_role', { _user_id: userId, _role: 'admin' });
  if (isAdmin !== true) return fail('Só os administradores podem gerir as pastas.');

  if (body.action === 'admin-list') {
    const raw = typeof body.path === 'string' ? body.path : '';
    if (!raw) {
      return ok({
        path: null,
        entries: ROOTS.map(name => ({ name, type: 'dir', path: name })),
      });
    }
    const path = cleanPath(raw);
    if (!path) return fail('Caminho inválido.');
    const listing = await callAgent<AgentListing>(secret, 'list', '/api/list', path);
    return ok({
      path,
      entries: listing.entries
        .filter(entry => entry.type === 'dir')
        .map(entry => ({ name: entry.name, type: 'dir', path: `${path}/${entry.name}` })),
      truncated: listing.truncated,
    });
  }

  // admin-mkdir: sempre dentro de uma raiz (não cria raízes novas em D:\\Shares)
  const path = cleanPath(body.path);
  if (!path || !parentPath(path)) return fail('Escolha primeiro a pasta onde a quer criar.');
  const result = await callAgent<{ created: boolean }>(secret, 'mkdir', '/api/mkdir', path);
  return ok({ path, created: result.created });
};

/**
 * Utilizador da sessão: a assinatura do JWT verifica-se aqui (chaves públicas do projeto), sem
 * ir ao servidor de login a cada pedido.
 */
const sessionUserId = async (req: Request, db: ReturnType<typeof serviceClient>) => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await db.auth.getClaims(header.slice(7).trim());
  return error ? null : ((data?.claims?.sub as string | undefined) ?? null);
};

type EmployeeFolders = {
  name: string;
  folders: { path: string; label: string | null; permission: FolderPermission }[];
};

/** Pastas de cada pessoa guardadas uns segundos (cada clique já não vai à base de dados). */
const FOLDERS_TTL_MS = 30_000;
const folderCache = new Map<string, { at: number; value: EmployeeFolders }>();

const loadEmployeeFolders = async (
  db: ReturnType<typeof serviceClient>,
  userId: string
): Promise<EmployeeFolders | null> => {
  const cached = folderCache.get(userId);
  if (cached && Date.now() - cached.at < FOLDERS_TTL_MS) return cached.value;
  const { data: employees, error } = await db
    .from('employees')
    .select('name, folder_assignments(path, label, permission)')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return null;
  const value: EmployeeFolders = {
    name: employees?.[0]?.name || 'Colaborador',
    folders: (employees ?? []).flatMap(employee => employee.folder_assignments ?? []),
  };
  folderCache.set(userId, { at: Date.now(), value });
  return value;
};

/** Nomes do que já existe numa pasta (para não substituir nada). */
const namesIn = async (secret: string, path: string) =>
  (await callAgent<AgentListing>(secret, 'list', '/api/list', path)).entries.map(
    entry => entry.name
  );

/** Config do editor para um ficheiro, assinada com o segredo do ONLYOFFICE. */
const openEditor = async (
  path: string,
  permission: FolderPermission,
  user: { id: string; name: string },
  secrets: { agent: string; office: string }
) => {
  const name = baseName(path);
  const extension = extensionOf(name);
  const documentType = documentTypeFor(extension);
  if (!documentType) throw new FilesError('Este ficheiro não abre no editor. Use "Descarregar".');

  // O agente não tem "stat": a data e o tamanho (para o document.key) vêm da pasta-mãe
  const listing = await callAgent<AgentListing>(
    secrets.agent,
    'list',
    '/api/list',
    parentPath(path)
  );
  const entry = listing.entries.find(item => item.type === 'file' && item.name === name);
  if (!entry) throw new FilesError('O ficheiro já não existe.');

  const mode = editorModeFor(extension, permission);
  const config = await buildEditorConfig({
    path,
    modified: entry.modified,
    size: entry.size,
    mode,
    documentType,
    user,
    localAgentUrl: LOCAL_AGENT_URL,
    downloadToken: await agentToken('download', path, TTL.editorDownload, secrets.agent),
    callbackToken: await agentToken('callback', path, TTL.callback, secrets.agent),
  });
  return {
    apiUrl: `${ONLYOFFICE_URL}/web-apps/apps/api/documents/api.js`,
    mode,
    config: { ...config, token: await signJwt(config, secrets.office) },
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const db = serviceClient();
  const userId = await sessionUserId(req, db);
  if (!userId) return json({ error: 'Não autorizado' }, 401);

  const agentSecret = Deno.env.get('FILES_AGENT_SECRET');
  const officeSecret = Deno.env.get('ONLYOFFICE_JWT_SECRET');
  if (!agentSecret || !officeSecret)
    return fail('O editor de documentos ainda não está configurado.');

  const body = (await req.json().catch(() => ({}))) as CompanyFilesRequest;
  if (body.action === 'admin-list' || body.action === 'admin-mkdir') {
    try {
      return await adminAction(db, userId, body, agentSecret);
    } catch (err) {
      // Aos admins mostra-se também a resposta do agente (para diagnosticar com o servidor).
      if (err instanceof FilesError)
        return fail(err.detail ? `${err.message} (${err.detail})` : err.message);
      throw err;
    }
  }
  const mine = await loadEmployeeFolders(db, userId);
  if (!mine) return fail('Não foi possível ler as suas pastas.');
  const folders = mine.folders;

  if (body.action === 'folders')
    return ok(
      folders.map(folder => ({
        path: folder.path,
        name: folder.label || baseName(folder.path),
        permission: folder.permission,
      }))
    );

  // Procurar pelo nome, só nas pastas atribuídas (também o que a Realize IA usa).
  if (body.action === 'search') {
    const query = typeof body.query === 'string' ? body.query.trim().slice(0, 100) : '';
    if (query.length < 2) return fail('Escreva pelo menos 2 letras.');
    if (!folders.length) return ok({ results: [], partial: false });
    return ok(
      await searchFiles(
        {
          list: async folderPath =>
            (await callAgent<AgentListing>(agentSecret, 'list', '/api/list', folderPath))
              .entries as SearchEntry[],
          search: (folderPath, q) => agentSearch(agentSecret, folderPath, q),
        },
        folders,
        query
      )
    );
  }

  if (body.action === 'thumbs') {
    const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    const targets: ThumbTarget[] = items.flatMap(item => {
      const raw = (item ?? {}) as { path?: unknown; modified?: unknown; size?: unknown };
      const itemPath = cleanPath(raw.path);
      // Só ficheiros das pastas a que a pessoa tem acesso
      if (!itemPath || !accessFor(itemPath, folders)) return [];
      return [
        {
          path: itemPath,
          modified: typeof raw.modified === 'string' ? raw.modified : '',
          size: typeof raw.size === 'number' ? raw.size : undefined,
        },
      ];
    });
    return ok(
      await thumbsFor(
        {
          db,
          agentSecret,
          officeSecret,
          agentUrl: AGENT_URL,
          localAgentUrl: LOCAL_AGENT_URL,
          officeUrl: ONLYOFFICE_URL,
        },
        targets
      )
    );
  }

  const path = cleanPath(body.path);
  if (!path) return fail('Caminho inválido.');
  // Uma pasta nova precisa de acesso à pasta onde é criada
  const permission = accessFor(body.action === 'mkdir' ? parentPath(path) : path, folders);
  if (!permission) return fail('Não tem acesso a esta pasta.');

  try {
    switch (body.action) {
      case 'list': {
        const listing = await callAgent<AgentListing>(agentSecret, 'list', '/api/list', path);
        return ok({ path, permission, entries: listing.entries, truncated: listing.truncated });
      }
      case 'download': {
        const token = await agentToken('download', path, TTL.browserDownload, agentSecret);
        return ok({ url: agentUrl(AGENT_URL, '/api/file', path, token) });
      }
      case 'mkdir': {
        if (permission !== 'edit') return fail(READ_ONLY);
        const result = await callAgent<{ created: boolean }>(
          agentSecret,
          'mkdir',
          '/api/mkdir',
          path
        );
        return ok({ path, created: result.created });
      }
      case 'create': {
        if (permission !== 'edit') return fail(READ_ONLY);
        if (!isBlankKind(body.kind)) return fail('Tipo de documento inválido.');
        const title = typeof body.name === 'string' ? body.name.trim() : '';
        const name = `${title}.${body.kind}`;
        if (!title || !isValidName(name)) return fail('Nome inválido.');
        const taken = await namesIn(agentSecret, path);
        if (freeName(name, taken) !== name)
          return fail('Já existe um ficheiro com esse nome nesta pasta.');
        const filePath = `${path}/${name}`;
        await callAgent(agentSecret, 'upload', '/api/upload', filePath, {
          bytes: blankFile(body.kind),
          type: BLANK_MIME[body.kind],
        });
        return ok({ path: filePath, name });
      }
      case 'upload': {
        if (permission !== 'edit') return fail(READ_ONLY);
        const original = typeof body.name === 'string' ? body.name.trim() : '';
        const size = Number(body.size);
        if (!isValidName(original))
          return fail(
            'O servidor não aceita este nome de ficheiro. Mude o nome e tente outra vez.'
          );
        if (isBlockedUpload(original))
          return fail('Por segurança, programas e scripts não podem ser carregados.');
        if (!Number.isFinite(size) || size < 0) return fail('Ficheiro inválido.');
        if (size > UPLOAD_MAX_BYTES) return fail('O ficheiro é demasiado grande (máximo 100 MB).');
        const name = freeName(original, await namesIn(agentSecret, path));
        const filePath = `${path}/${name}`;
        const token = await agentToken('upload', filePath, TTL.browserUpload, agentSecret);
        return ok({
          path: filePath,
          name,
          url: agentUrl(AGENT_URL, '/api/upload', filePath, token),
        });
      }
      case 'open': {
        const user = { id: userId, name: mine.name };
        return ok(
          await openEditor(path, permission, user, { agent: agentSecret, office: officeSecret })
        );
      }
      default:
        return fail('Ação desconhecida.');
    }
  } catch (err) {
    if (err instanceof FilesError) return fail(err.message, err.detail);
    throw err;
  }
});
