// Assinaturas de email de uma pessoa, geridas por um administrador (mail_signatures com o
// user_id da pessoa). Só nas caixas a que a pessoa tem acesso: as dela e as partilhadas com ela.

import type { serviceClient } from '../_shared/mail-server/http.ts';

type Db = ReturnType<typeof serviceClient>;

const MAX_SIGNATURES = 20;
const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

interface SignatureInput {
  id: string;
  name: string;
  html: string;
  isDefault: boolean;
}

/** Caixas a que a pessoa tem acesso (próprias e partilhadas), por ordem de endereço. */
const personAccounts = async (db: Db, userId: string) => {
  const [own, shared] = await Promise.all([
    db.from('mail_accounts').select('id, email, display_name').eq('user_id', userId),
    db.from('mail_account_members').select('account_id').eq('user_id', userId),
  ]);
  if (own.error) throw own.error;
  if (shared.error) throw shared.error;
  const sharedIds = (shared.data ?? []).map(row => row.account_id as string);
  const sharedAccounts = sharedIds.length
    ? await db.from('mail_accounts').select('id, email, display_name').in('id', sharedIds)
    : { data: [], error: null };
  if (sharedAccounts.error) throw sharedAccounts.error;
  const byId = new Map<string, { id: string; email: string; name: string | null }>();
  for (const row of [...(own.data ?? []), ...(sharedAccounts.data ?? [])])
    byId.set(row.id as string, {
      id: row.id as string,
      email: row.email as string,
      name: (row.display_name as string | null) ?? null,
    });
  return [...byId.values()].sort((a, b) => a.email.localeCompare(b.email));
};

/** Caixas da pessoa e as assinaturas dela em cada uma. */
export const listPersonSignatures = async (db: Db, userId: string) => {
  const accounts = await personAccounts(db, userId);
  const { data, error } = accounts.length
    ? await db
        .from('mail_signatures')
        .select('id, account_id, name, html, is_default, position')
        .eq('user_id', userId)
        .in(
          'account_id',
          accounts.map(account => account.id)
        )
        .order('position')
    : { data: [], error: null };
  if (error) throw error;
  return accounts.map(account => ({
    ...account,
    signatures: (data ?? [])
      .filter(row => row.account_id === account.id)
      .map(row => ({
        id: row.id as string,
        name: row.name as string,
        html: row.html as string,
        isDefault: row.is_default === true,
      })),
  }));
};

const parseList = (raw: unknown): SignatureInput[] | null => {
  if (!Array.isArray(raw) || raw.length > MAX_SIGNATURES) return null;
  const list: SignatureInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const value = item as Record<string, unknown>;
    const name = typeof value.name === 'string' ? value.name.trim() : '';
    const html = typeof value.html === 'string' ? value.html : '';
    if (!isUuid(value.id) || name.length < 1 || name.length > 60 || html.length > 20000)
      return null;
    list.push({ id: value.id, name, html, isDefault: value.isDefault === true });
  }
  // No máximo uma predefinida (a primeira marcada)
  const firstDefault = list.findIndex(signature => signature.isDefault);
  return list.map((signature, index) => ({ ...signature, isDefault: index === firstDefault }));
};

/**
 * Grava as assinaturas da pessoa numa caixa (como o próprio faria no Webmail): o que saiu da
 * lista apaga-se e o resto grava-se pela ordem. Devolve a mensagem de erro, ou null.
 */
export const savePersonSignatures = async (
  db: Db,
  userId: string,
  accountId: unknown,
  rawList: unknown
): Promise<string | null> => {
  if (!isUuid(accountId)) return 'Caixa inválida.';
  const list = parseList(rawList);
  if (!list) return 'Assinaturas inválidas (nome de 1 a 60 letras, no máximo 20).';
  const accounts = await personAccounts(db, userId);
  if (!accounts.some(account => account.id === accountId))
    return 'Esta pessoa não tem acesso a esta caixa.';

  // Um id que já é de outra pessoa ou de outra caixa não se reescreve
  if (list.length) {
    const { data: taken, error: takenError } = await db
      .from('mail_signatures')
      .select('id')
      .in(
        'id',
        list.map(signature => signature.id)
      )
      .or(`user_id.neq.${userId},account_id.neq.${accountId}`);
    if (takenError) throw takenError;
    if ((taken ?? []).length) return 'Assinaturas inválidas.';
  }

  const mine = () =>
    db.from('mail_signatures').delete().eq('user_id', userId).eq('account_id', accountId);
  const removed = list.length
    ? await mine().not('id', 'in', `(${list.map(signature => signature.id).join(',')})`)
    : await mine();
  if (removed.error) throw removed.error;
  const cleared = await db
    .from('mail_signatures')
    .update({ is_default: false })
    .eq('user_id', userId)
    .eq('account_id', accountId);
  if (cleared.error) throw cleared.error;
  if (!list.length) return null;
  const { error } = await db.from('mail_signatures').upsert(
    list.map((signature, position) => ({
      id: signature.id,
      user_id: userId,
      account_id: accountId,
      name: signature.name,
      html: signature.html,
      is_default: signature.isDefault,
      position,
    }))
  );
  if (error) throw error;
  return null;
};
