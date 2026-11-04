// Regras e marcadores guardam a pasta de destino (id e nome). Quando a pasta muda de nome ou é
// apagada, essas referências acompanham-na em vez de ficarem a apontar para uma pasta que já não
// existe (a regra falharia a cada email novo).

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { LabelAutomation } from '../_shared/mail/labels.ts';

interface LabelRow {
  id: string;
  on_apply: LabelAutomation | null;
}

const labelsWithFolder = async (db: SupabaseClient, accountId: string): Promise<LabelRow[]> => {
  const { data, error } = await db
    .from('mail_labels')
    .select('id, on_apply')
    .eq('account_id', accountId);
  if (error) throw error;
  return ((data ?? []) as LabelRow[]).filter(label => !!label.on_apply?.folder_id);
};

/** A pasta mudou de nome: `moved` são os pares [id antigo, id novo] (IMAP); `name` é o nome novo. */
export const renameFolderRefs = async (
  db: SupabaseClient,
  accountId: string,
  folderId: string,
  newId: string,
  name: string,
  moved: [string, string][]
): Promise<void> => {
  const remap = new Map<string, string>(moved);
  remap.set(folderId, newId);
  for (const [from, to] of remap) {
    const patch = from === folderId ? { folder_id: to, folder_name: name } : { folder_id: to };
    const { error } = await db
      .from('mail_rules')
      .update(patch)
      .eq('account_id', accountId)
      .eq('folder_id', from);
    if (error) throw error;
  }
  for (const label of await labelsWithFolder(db, accountId)) {
    const current = label.on_apply?.folder_id ?? '';
    const next = remap.get(current);
    if (!next) continue;
    const on_apply = {
      ...label.on_apply,
      folder_id: next,
      ...(current === folderId ? { folder_name: name } : {}),
    };
    const { error } = await db.from('mail_labels').update({ on_apply }).eq('id', label.id);
    if (error) throw error;
  }
};

/** A pasta foi apagada: as regras que só a usavam param; as que também põem marcadores ficam. */
export const dropFolderRefs = async (
  db: SupabaseClient,
  accountId: string,
  removed: string[]
): Promise<void> => {
  if (!removed.length) return;
  const gone = new Set(removed);
  const { data: rules, error } = await db
    .from('mail_rules')
    .select('id, label_ids, folder_id')
    .eq('account_id', accountId)
    .in('folder_id', removed);
  if (error) throw error;
  for (const rule of (rules ?? []) as { id: string; label_ids: string[] | null }[]) {
    const onlyFolder = !(rule.label_ids ?? []).length;
    const { error: updateError } = await db
      .from('mail_rules')
      .update({
        folder_id: null,
        folder_name: null,
        ...(onlyFolder ? { is_active: false, last_error: 'A pasta de destino foi apagada.' } : {}),
      })
      .eq('id', rule.id);
    if (updateError) throw updateError;
  }
  for (const label of await labelsWithFolder(db, accountId)) {
    if (!gone.has(label.on_apply?.folder_id ?? '')) continue;
    const { folder_id: _id, folder_name: _name, ...rest } = label.on_apply ?? {};
    const { error: updateError } = await db
      .from('mail_labels')
      .update({ on_apply: rest })
      .eq('id', label.id);
    if (updateError) throw updateError;
  }
};
