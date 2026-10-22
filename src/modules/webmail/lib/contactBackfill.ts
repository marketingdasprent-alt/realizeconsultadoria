// Primeira vez: aprende os contactos com a pasta Enviados de cada caixa (a 1.ª página de cada).
import { contactService } from '../services/contactService';
import { mailService } from '../services/mailService';

const FLAG = 'rz.mail.contacts.backfilled';

const done = (): boolean => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

/** Devolve true se registou contactos novos. Corre no máximo uma vez por aparelho. */
export const backfillContacts = async (accountIds: string[]): Promise<boolean> => {
  if (done() || !accountIds.length) return false;
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // sem armazenamento: tenta outra vez da próxima
  }
  const counts = new Map<string, { email: string; name: string | null; uses: number }>();
  for (const accountId of accountIds) {
    const { data } = await mailService.list(accountId, 'sent', '', null);
    for (const message of data?.messages ?? []) {
      for (const to of message.to) {
        const email = to.email.trim().toLowerCase();
        if (!email) continue;
        const known = counts.get(email);
        counts.set(email, {
          email,
          name: known?.name ?? to.name,
          uses: (known?.uses ?? 0) + 1,
        });
      }
    }
  }
  if (!counts.size) return false;
  const { error } = await contactService.remember([...counts.values()]);
  return !error;
};
