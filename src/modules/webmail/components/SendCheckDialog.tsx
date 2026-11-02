import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SendCheck } from '../lib/sendCheck';

interface SendCheckDialogProps {
  /** null = fechado. */
  check: SendCheck | null;
  onSend: () => void;
  onClose: () => void;
}

/** Antes de enviar: avisa que falta o destinatário ou pergunta se segue sem assunto/texto. */
export const SendCheckDialog: React.FC<SendCheckDialogProps> = ({ check, onSend, onClose }) => {
  // Endereço mal escrito: não segue (senão essa pessoa ficava de fora sem ninguém saber).
  const stop = !!check && (check.blocked || check.invalid.length > 0);
  return (
    <AlertDialog open={!!check} onOpenChange={open => !open && onClose()}>
      <AlertDialogContent className="rounded-[28px] sm:rounded-[28px]">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {check?.invalid.length
              ? 'Endereço de email inválido'
              : check?.blocked
                ? 'Falta o destinatário'
                : 'Enviar mesmo assim?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {check?.invalid.length
              ? `Não é um email válido: ${check.invalid.join(', ')}. Corrija ou apague antes de enviar.`
              : check?.blocked
                ? 'Escreva pelo menos um email em "Para" (ou em Cc/Bcc) antes de enviar.'
                : `Este email vai sem ${check?.missing.join(' e sem ')}.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {stop ? (
            <AlertDialogAction className="rounded-full" onClick={onClose}>
              Voltar ao email
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel className="rounded-full">Voltar ao email</AlertDialogCancel>
              <AlertDialogAction className="rounded-full" onClick={onSend}>
                Enviar assim
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
