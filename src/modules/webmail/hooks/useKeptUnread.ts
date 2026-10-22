import { useCallback, useEffect, useMemo, useState } from 'react';
import { dropKept, keepOpened, mergeKept } from '../lib/keptUnread';
import type { MailFolder, MailSummary } from '../types';

/**
 * Na pasta "Não lidos", os emails abertos ficam na lista (já como lidos) até se mudar de pasta,
 * de caixa ou de pesquisa, ou até se atualizar à mão.
 */
export const useKeptUnread = (
  folder: MailFolder,
  scope: string,
  query: string,
  live: MailSummary[]
) => {
  const [kept, setKept] = useState<MailSummary[]>([]);
  useEffect(() => setKept([]), [folder, scope, query]);

  const keep = useCallback(
    (mail: MailSummary) => {
      if (folder === 'unread') setKept(list => keepOpened(list, mail));
    },
    [folder]
  );
  const drop = useCallback((mails: MailSummary[]) => setKept(list => dropKept(list, mails)), []);
  const clear = useCallback(() => setKept([]), []);
  const messages = useMemo(
    () => (folder === 'unread' ? mergeKept(live, kept) : live),
    [folder, live, kept]
  );
  return { messages, keep, drop, clear };
};
