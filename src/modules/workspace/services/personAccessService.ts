// Acessos de uma pessoa dados por um administrador a partir do Workspace (edge function
// person-access): pastas da empresa e caixas de email partilhadas.
import { supabase } from '@/integrations/supabase/client';
import type { MailSignature } from '@/modules/webmail/types';

export type AccessPermission = 'read' | 'edit';

export interface PersonFolder {
  id: string;
  path: string;
  label: string | null;
  permission: AccessPermission;
}

export interface PersonMailbox {
  accessId: string;
  email: string;
  name: string | null;
  assigned: boolean;
}

/** Caixa de email da pessoa e as assinaturas dela nessa caixa. */
export interface PersonSignatureAccount {
  id: string;
  email: string;
  name: string | null;
  signatures: MailSignature[];
}

export interface PersonAccess {
  employee: { id: string; name: string };
  folders: PersonFolder[];
  mailboxes: PersonMailbox[];
}

const UNAVAILABLE = 'Não foi possível. Tente outra vez.';

const call = async <T>(body: Record<string, unknown>) => {
  try {
    const { data, error } = await supabase.functions.invoke('person-access', { body });
    if (error || !data) return { data: null as T | null, error: UNAVAILABLE };
    if (!data.ok) return { data: null as T | null, error: (data.message as string) || UNAVAILABLE };
    return { data: data.data as T, error: null };
  } catch {
    return { data: null as T | null, error: UNAVAILABLE };
  }
};

export const personAccessService = {
  overview: (userId: string) => call<PersonAccess>({ action: 'overview', user_id: userId }),

  setFolder: (userId: string, path: string, permission: AccessPermission) =>
    call<{ path: string }>({ action: 'folder-set', user_id: userId, path, permission }),

  removeFolder: (userId: string, id: string) =>
    call<{ id: string }>({ action: 'folder-remove', user_id: userId, id }),

  setMailbox: (userId: string, accessId: string, on: boolean) =>
    call<{ accessId: string }>({ action: 'mailbox-set', user_id: userId, access_id: accessId, on }),

  signatures: (userId: string) =>
    call<PersonSignatureAccount[]>({ action: 'signatures', user_id: userId }),

  saveSignatures: (userId: string, accountId: string, list: MailSignature[]) =>
    call<{ accountId: string }>({
      action: 'signatures-save',
      user_id: userId,
      account_id: accountId,
      list,
    }),
};
