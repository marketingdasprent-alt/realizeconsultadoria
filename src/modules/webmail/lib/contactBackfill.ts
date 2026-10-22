// Primeira vez: aprende os contactos com a pasta Enviados de cada caixa (a 1.ª página de cada).
import { contactService } from '../services/contactService';
import { cleanContactName } from './recipients';
import { mailService } from '../services/mailService';

const FLAG = 'rz.mail.contacts.backfilled';
let running = false;

const done = (): boolean => {
  try {
    return localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
};

const markDone = () => {
  try {
    localStorage.setItem(FLAG, '1');
  } catch {
    // sem armazenamento: tenta outra vez da próxima
  }
};

/**
 * Devolve true se registou contactos novos. Corre no máximo uma vez por aparelho, e só fica
 * marcado como feito quando tudo correu bem (uma falha de rede volta a tentar da próxima).
 */
export const backfillContacts = async (accountIds: string[]): Promise<boolean> => {
  if (running || done() || !accountIds.length) return false;
  running = true;
  try {
    const counts = new Map<string, { email: string; name: string | null; uses: number }>();
    let failed = false;
    for (const accountId of accountIds) {
      const { data, error } = await mailService.list(accountId, 'sent', '', null);
      if (error || !data) {
        failed = true;
        continue;
      }
      for (const message of data.messages) {
        for (const to of message.to) {
          const email = to.email.trim().toLowerCase();
          if (!email) continue;
          const known = counts.get(email);
          counts.set(email, {
            email,
            name: known?.name ?? cleanContactName(to.name),
            uses: (known?.uses ?? 0) + 1,
          });
        }
      }
    }
    if (counts.size) {
      const { error } = await contactService.remember([...counts.values()]);
      if (error) return false;
    }
    if (!failed) markDone();
    return counts.size > 0;
  } finally {
    running = false;
  }
};
