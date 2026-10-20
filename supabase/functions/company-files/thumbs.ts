// Miniaturas dos Documentos da empresa (vista em grelha):
//   * documentos, folhas, apresentações e PDF → 1.ª página, gerada pelo conversor do
//     ONLYOFFICE e guardada no Storage (bucket privado company-file-thumbs); o nome é o hash do
//     caminho + data + tamanho, por isso um ficheiro alterado gera outra;
//   * imagens pequenas → o link direto do agente (o browser mostra a própria imagem).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  agentToken,
  agentUrl,
  baseName,
  documentKey,
  documentTypeFor,
  extensionOf,
  signJwt,
} from '../_shared/company-files.ts';
import { fetchWithTimeout } from '../_shared/mail-server/http.ts';

const BUCKET = 'company-file-thumbs';
const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
/** Imagens maiores do que isto ficam com o ícone (a miniatura seria a imagem inteira). */
const IMAGE_MAX_BYTES = 2_500_000;
const LINK_TTL_S = 6 * 3600;
const CONCURRENCY = 3;

export interface ThumbTarget {
  path: string;
  modified: string;
  size?: number;
}

export interface ThumbContext {
  db: SupabaseClient;
  agentSecret: string;
  officeSecret: string;
  agentUrl: string;
  localAgentUrl: string;
  officeUrl: string;
}

const signedThumb = async (db: SupabaseClient, name: string) => {
  const { data } = await db.storage.from(BUCKET).createSignedUrl(name, LINK_TTL_S);
  return data?.signedUrl ?? null;
};

/** 1.ª página pelo conversor do ONLYOFFICE (o ficheiro vem do agente local, 127.0.0.1). */
const convertFirstPage = async (ctx: ThumbContext, target: ThumbTarget, key: string) => {
  const downloadToken = await agentToken('download', target.path, 600, ctx.agentSecret);
  const payload = {
    async: false,
    filetype: extensionOf(baseName(target.path)),
    key,
    outputtype: 'png',
    thumbnail: { aspect: 1, first: true, width: 360, height: 480 },
    title: baseName(target.path),
    url: agentUrl(ctx.localAgentUrl, '/api/file', target.path, downloadToken),
  };
  const res = await fetchWithTimeout(
    `${ctx.officeUrl}/converter`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ...payload, token: await signJwt(payload, ctx.officeSecret) }),
    },
    25_000
  );
  const body = (await res.json().catch(() => null)) as {
    endConvert?: boolean;
    fileUrl?: string;
    error?: number;
  } | null;
  if (!res.ok || !body?.endConvert || !body.fileUrl) {
    console.error('company-files thumbs: conversor', res.status, body?.error);
    return null;
  }
  const image = await fetchWithTimeout(body.fileUrl, {}, 15_000);
  if (!image.ok) return null;
  return new Uint8Array(await image.arrayBuffer());
};

const thumbFor = async (ctx: ThumbContext, target: ThumbTarget): Promise<string | null> => {
  const extension = extensionOf(baseName(target.path));
  if (IMAGE_EXTENSIONS.includes(extension)) {
    if ((target.size ?? 0) > IMAGE_MAX_BYTES) return null;
    const token = await agentToken('download', target.path, LINK_TTL_S, ctx.agentSecret);
    return agentUrl(ctx.agentUrl, '/api/file', target.path, token);
  }
  if (!documentTypeFor(extension)) return null;

  const key = await documentKey(target.path, target.modified, target.size);
  const name = `${key}.png`;
  const existing = await signedThumb(ctx.db, name);
  if (existing) return existing;
  const png = await convertFirstPage(ctx, target, key);
  if (!png) return null;
  const { error } = await ctx.db.storage
    .from(BUCKET)
    .upload(name, png, { contentType: 'image/png', upsert: true });
  if (error) {
    console.error('company-files thumbs: storage', error.message);
    return null;
  }
  return signedThumb(ctx.db, name);
};

/** Miniaturas de vários ficheiros (3 de cada vez); as que falharem ficam null (ícone). */
export const thumbsFor = async (ctx: ThumbContext, targets: ThumbTarget[]) => {
  const result: Record<string, string | null> = {};
  let next = 0;
  const worker = async () => {
    while (next < targets.length) {
      const target = targets[next++];
      try {
        result[target.path] = await thumbFor(ctx, target);
      } catch (error) {
        console.error(
          'company-files thumbs:',
          target.path,
          error instanceof Error ? error.message : error
        );
        result[target.path] = null;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));
  return result;
};
