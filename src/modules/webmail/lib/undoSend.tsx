import React from 'react';
import { ToastAction } from '@/components/ui/toast';
import { toast } from '@/hooks/use-toast';

/** Tempo para anular o envio depois de carregar em Enviar (como o Gmail/Outlook). */
export const UNDO_SEND_MS = 10_000;

/**
 * Mostra "A enviar… Anular" durante 10 s. Devolve true se a pessoa anulou (o email não sai e
 * volta a abrir), false quando o tempo acaba e o envio segue.
 */
export const waitForUndo = (subject: string): Promise<boolean> =>
  new Promise(resolve => {
    let done = false;
    const finish = (undone: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      notice.dismiss();
      resolve(undone);
    };
    const notice = toast({
      title: 'A enviar…',
      description: subject || undefined,
      duration: UNDO_SEND_MS + 1000,
      action: (
        <ToastAction altText="Anular o envio" onClick={() => finish(true)}>
          Anular
        </ToastAction>
      ),
    });
    const timer = setTimeout(() => finish(false), UNDO_SEND_MS);
  });
