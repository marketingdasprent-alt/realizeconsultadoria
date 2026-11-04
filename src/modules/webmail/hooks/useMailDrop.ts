import { useState } from 'react';
import { canDropOn, draggedMails, endMailDrag } from '../lib/mailDrag';
import type { MailSummary } from '../types';

/**
 * Largar emails arrastados numa pasta ou num marcador. `bind(key, accountId, onDrop)` dá os
 * eventos para a linha; `overKey` é a linha por cima (para a realçar). Só aceita emails da
 * mesma caixa da linha.
 */
export const useMailDrop = () => {
  const [overKey, setOverKey] = useState<string | null>(null);

  const bind = (key: string, accountId: string, onDrop: (mails: MailSummary[]) => void) => ({
    onDragOver: (event: React.DragEvent) => {
      if (!canDropOn(accountId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      if (overKey !== key) setOverKey(key);
    },
    onDragLeave: () => setOverKey(current => (current === key ? null : current)),
    onDrop: (event: React.DragEvent) => {
      if (!canDropOn(accountId)) return;
      event.preventDefault();
      const mails = draggedMails();
      endMailDrag();
      setOverKey(null);
      onDrop(mails);
    },
  });

  return { overKey, bind };
};
