// Quem pode chamar as funções de email que não são abertas ao público. Sem dependências do Deno,
// para se poderem testar. Há duas portas, nunca as duas abertas a qualquer pessoa:
//   * utilizador com sessão (o ecrã): a função verifica o JWT e o que o pedido faz sentido;
//   * sistema (a base de dados, lembretes): Authorization "Bearer <chave de serviço>" (a que o
//     Supabase já injeta na função) ou o cabeçalho x-system-token com o token de sistema que a
//     base já guarda no cofre (o mesmo de push-send e mail-api).
// Nenhum segredo vai para os registos nem para as respostas.

export interface SystemSecrets {
  /** SUPABASE_SERVICE_ROLE_KEY do ambiente da função. */
  serviceKey?: string | null;
  /** MAIL_SYSTEM_TOKEN do ambiente da função. */
  systemToken?: string | null;
}

/** Comparação em tempo constante (não deixa adivinhar o segredo pelo tempo de resposta). */
export const safeEqual = (a: string, b: string): boolean => {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  const length = Math.max(x.length, y.length);
  for (let i = 0; i < length; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
};

/** O "Bearer <token>" do cabeçalho Authorization, ou null. */
export const bearerToken = (req: Request): string | null => {
  const header = req.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
};

/** A chamada vem do sistema (chave de serviço ou token de sistema)? Segredo vazio nunca serve. */
export const isSystemCall = (req: Request, secrets: SystemSecrets): boolean => {
  const bearer = bearerToken(req);
  if (secrets.serviceKey && bearer && safeEqual(bearer, secrets.serviceKey)) return true;
  const header = req.headers.get('x-system-token');
  return !!(secrets.systemToken && header && safeEqual(header, secrets.systemToken));
};

export const errorResponse = (
  status: number,
  message: string,
  cors: Record<string, string>
): Response =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });

/** null se a chamada é do sistema; senão a resposta 401 (nada é enviado). */
export const systemCallDenied = (
  req: Request,
  secrets: SystemSecrets,
  cors: Record<string, string>
): Response | null =>
  isSystemCall(req, secrets) ? null : errorResponse(401, 'Não autorizado.', cors);

/** Texto seguro para pôr dentro de HTML (o texto aparece como foi escrito, sem executar HTML). */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Janela em que um ticket ou resposta acabado de criar ainda pede o aviso. */
export const RECENT_MS = 15 * 60_000;

/** Foi criado há pouco (até 15 minutos; 1 minuto de folga para relógios desacertados)? */
export const isRecent = (iso: string, now = Date.now()): boolean => {
  const at = Date.parse(iso);
  return Number.isFinite(at) && now - at >= -60_000 && now - at <= RECENT_MS;
};
