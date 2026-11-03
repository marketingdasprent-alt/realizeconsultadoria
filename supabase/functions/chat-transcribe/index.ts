// Transcrição das mensagens de voz do Mensagens (texto de cada áudio, guardado uma só vez).
//
// POST { action: 'list', conversation_id }  → [{ message_id, text }] das mensagens já transcritas
// POST { action: 'transcribe', message_id } → { text }: transcreve (se ainda não estiver) e guarda
//
// O áudio vai do Storage (bucket chat-files, link de 2 minutos) para um servidor de voz com a API
// compatível com a da OpenAI (POST /v1/audio/transcriptions: faster-whisper-server, whisper.cpp
// server, etc. — ver docs/realize-2/stt-server-whisper.md). O Claude não aceita áudio.
// Segredos da função: STT_BASE_URL (ex.: https://stt.dasprent.pt), STT_API_KEY (opcional),
// STT_MODEL (opcional, por omissão "large-v3").
//
// verify_jwt = false: a sessão valida-se aqui e só membros da conversa passam.
// Respostas { ok: true, data } ou { ok: false, message }.

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { corsHeaders, fetchWithTimeout, json, serviceClient } from '../_shared/mail-server/http.ts';

type Db = ReturnType<typeof serviceClient>;

const STT_URL = Deno.env.get('STT_BASE_URL')?.replace(/\/+$/, '');
const STT_KEY = Deno.env.get('STT_API_KEY')?.trim();
const STT_MODEL = Deno.env.get('STT_MODEL')?.trim() || 'large-v3';
const BUCKET = 'chat-files';
const MAX_BYTES = 25 * 1024 * 1024;
// O servidor (Whisper medium, só processador) demora ~32 s por minuto de áudio e a função tem
// um limite de ~150 s: 3 minutos de áudio cabem, mais não.
const MAX_SECONDS = 3 * 60;
const STT_TIMEOUT_MS = 130_000;

const ok = (data: unknown) => json({ ok: true, data });
const fail = (message: string) => json({ ok: false, message });
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const sessionUserId = async (req: Request, db: Db) => {
  const header = req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const { data, error } = await db.auth.getClaims(header.slice(7).trim());
  return error ? null : ((data?.claims?.sub as string | undefined) ?? null);
};

const isMember = async (db: Db, userId: string, conversationId: string) => {
  const { data } = await db
    .from('chat_members')
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
};

const extensionOf = (mime: string) =>
  mime.includes('webm')
    ? 'webm'
    : mime.includes('ogg')
      ? 'ogg'
      : mime.includes('mp4')
        ? 'm4a'
        : mime.includes('mpeg')
          ? 'mp3'
          : mime.includes('wav')
            ? 'wav'
            : 'webm';

const transcribe = async (db: Db, userId: string, messageId: string) => {
  const { data: message } = await db
    .from('chat_messages')
    .select('id, conversation_id, kind, attachment_path, attachment_mime, duration_sec, deleted_at')
    .eq('id', messageId)
    .maybeSingle();
  if (!message || message.kind !== 'audio' || message.deleted_at || !message.attachment_path)
    return fail('Esta mensagem não tem áudio.');
  if (!(await isMember(db, userId, message.conversation_id as string)))
    return fail('Não tem acesso a esta conversa.');

  const { data: existing } = await db
    .from('chat_message_transcripts')
    .select('text')
    .eq('message_id', messageId)
    .maybeSingle();
  if (existing) return ok({ text: existing.text as string });

  if (!STT_URL) return fail('A transcrição ainda não está ativa (falta ligar o servidor de voz).');
  if (Number(message.duration_sec ?? 0) > MAX_SECONDS)
    return fail('O áudio é demasiado longo para transcrever (máximo 3 minutos).');

  const { data: signed } = await db.storage
    .from(BUCKET)
    .createSignedUrl(message.attachment_path as string, 120);
  if (!signed?.signedUrl) return fail('Não foi possível abrir o áudio.');
  const audio = await fetchWithTimeout(signed.signedUrl, {}, 30_000);
  if (!audio.ok) return fail(`Não foi possível abrir o áudio (HTTP ${audio.status}).`);
  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) return fail('O áudio é demasiado grande para transcrever.');

  const mime = ((message.attachment_mime as string | null) ?? 'audio/webm').split(';')[0];
  const form = new FormData();
  form.append('file', new Blob([bytes], { type: mime }), `voz.${extensionOf(mime)}`);
  form.append('model', STT_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');

  let text = '';
  try {
    const res = await fetchWithTimeout(
      `${STT_URL}/v1/audio/transcriptions`,
      {
        method: 'POST',
        headers: STT_KEY ? { Authorization: `Bearer ${STT_KEY}` } : {},
        body: form,
      },
      STT_TIMEOUT_MS
    );
    if (!res.ok) {
      const detail = (await res.text()).replace(/s+/g, ' ').slice(0, 160);
      console.error('chat-transcribe: servidor de voz', res.status, detail);
      return fail(`O servidor de voz recusou o pedido (HTTP ${res.status}). ${detail}`.trim());
    }
    const body = (await res.json().catch(() => null)) as { text?: unknown } | null;
    text = typeof body?.text === 'string' ? body.text.trim() : '';
  } catch (error) {
    const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.error('chat-transcribe:', reason);
    return fail(`Não foi possível falar com o servidor de voz (${reason.slice(0, 160)}).`);
  }

  await db
    .from('chat_message_transcripts')
    .upsert(
      { message_id: messageId, text, model: STT_MODEL, requested_by: userId },
      { onConflict: 'message_id' }
    );
  return ok({ text });
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405);

  const db = serviceClient();
  const userId = await sessionUserId(req, db);
  if (!userId) return json({ error: 'Não autorizado' }, 401);

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.action === 'list') {
    if (!isUuid(body.conversation_id)) return fail('Conversa inválida.');
    if (!(await isMember(db, userId, body.conversation_id))) return fail('Sem acesso.');
    const { data } = await db
      .from('chat_message_transcripts')
      .select('message_id, text, chat_messages!inner(conversation_id)')
      .eq('chat_messages.conversation_id', body.conversation_id)
      .limit(500);
    return ok(
      (data ?? []).map(row => ({ message_id: row.message_id as string, text: row.text as string }))
    );
  }
  if (body.action === 'transcribe') {
    if (!isUuid(body.message_id)) return fail('Mensagem inválida.');
    return await transcribe(db, userId, body.message_id);
  }
  return fail('Ação desconhecida.');
});
