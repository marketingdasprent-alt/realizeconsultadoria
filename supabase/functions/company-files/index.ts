// Documentos da empresa: pastas do servidor de ficheiros (SRVDC, D:\Shares) abertas no editor
// ONLYOFFICE, só dentro das pastas atribuídas ao colaborador (tabela folder_assignments).
//
// POST { action: 'folders' }         → pastas atribuídas
// POST { action: 'list', path }      → conteúdo de uma pasta
// POST { action: 'open', path }      → config do editor ONLYOFFICE, assinada
// POST { action: 'download', path }  → link de descarga direto do agente (5 min)
// POST { action: 'mkdir', path }     → nova pasta (precisa de permissão de edição)
//
// Respostas { ok: true, data } ou { ok: false, message }. Os segredos nunca saem daqui: o
// browser só recebe tokens curtos, de uma operação e de um caminho; o document.url e o
// callbackUrl do editor apontam para o agente local (127.0.0.1), que só o ONLYOFFICE alcança.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import {
  authenticatedUserId,
  corsHeaders,
  fetchWithTimeout,
  json,
  serviceClient,
} from '../_shared/mail-server/http.ts';
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
  parentPath,
  signJwt,
  type AgentOp,
  type FolderPermission,
} from '../_shared/company-files.ts';

const AGENT_URL = Deno.env.get('FILES_AGENT_URL') ?? 'https://files.dasprent.pt';
const LOCAL_AGENT_URL = Deno.env.get('FILES_AGENT_LOCAL_URL') ?? 'http://127.0.0.1:8181';
const ONLYOFFICE_URL = Deno.env.get('ONLYOFFICE_URL') ?? 'https://office.dasprent.pt';

/** Validade dos tokens do agente, em segundos. */
const TTL = {
  request: 60,
  browserDownload: 5 * 60,
  editorDownload: 12 * 3600,
  callback: 48 * 3600,
};

interface CompanyFilesRequest {
  action?: 'folders' | 'list' | 'open' | 'download' | 'mkdir';
  path?: unknown;
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
class FilesError extends Error {}

const ok = (data: unknown) => json({ ok: true, data });
const fail = (message: string) => json({ ok: false, message });

/** Pedido ao agente pelo túnel, com um token só para esta operação e caminho. */
const callAgent = async <T>(secret: string, op: AgentOp, route: string, path: string) => {
  const token = await agentToken(op, path, TTL.request, secret);
  let res: Response;
  try {
    res = await fetchWithTimeout(agentUrl(AGENT_URL, route, path), {
      method: op === 'mkdir' ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new FilesError('O servidor de ficheiros não responde. Tente daqui a pouco.');
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    console.error('company-files: agente', res.status, body?.error);
    throw new FilesError(AGENT_ERRORS[res.status] ?? 'O servidor de ficheiros deu um erro.');
  }
  return body as T;
};

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
  const userId = await authenticatedUserId(req, db);
  if (!userId) return json({ error: 'Não autorizado' }, 401);

  const agentSecret = Deno.env.get('FILES_AGENT_SECRET');
  const officeSecret = Deno.env.get('ONLYOFFICE_JWT_SECRET');
  if (!agentSecret || !officeSecret)
    return fail('O editor de documentos ainda não está configurado.');

  const body = (await req.json().catch(() => ({}))) as CompanyFilesRequest;
  const { data: employees, error } = await db
    .from('employees')
    .select('name, folder_assignments(path, label, permission)')
    .eq('user_id', userId)
    .eq('is_active', true);
  if (error) return fail('Não foi possível ler as suas pastas.');
  const folders = (employees ?? []).flatMap(employee => employee.folder_assignments ?? []);

  if (body.action === 'folders')
    return ok(
      folders.map(folder => ({
        path: folder.path,
        name: folder.label || baseName(folder.path),
        permission: folder.permission,
      }))
    );

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
        if (permission !== 'edit') return fail('Nesta pasta só tem acesso de leitura.');
        const result = await callAgent<{ created: boolean }>(
          agentSecret,
          'mkdir',
          '/api/mkdir',
          path
        );
        return ok({ path, created: result.created });
      }
      case 'open': {
        const user = { id: userId, name: employees?.[0]?.name || 'Colaborador' };
        return ok(
          await openEditor(path, permission, user, { agent: agentSecret, office: officeSecret })
        );
      }
      default:
        return fail('Ação desconhecida.');
    }
  } catch (err) {
    if (err instanceof FilesError) return fail(err.message);
    throw err;
  }
});
