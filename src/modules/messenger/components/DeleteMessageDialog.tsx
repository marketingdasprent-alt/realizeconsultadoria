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
import type { ChatMessage } from '../types';

interface DeleteMessageDialogProps {
  message: ChatMessage | null;
  onClose: () => void;
  onConfirm: (message: ChatMessage) => void;
}

/** Confirmação antes de eliminar uma mensagem (o conteúdo é apagado para todos). */
export const DeleteMessageDialog: React.FC<DeleteMessageDialogProps> = ({
  message,
  onClose,
  onConfirm,
}) => (
  <AlertDialog open={!!message} onOpenChange={open => !open && onClose()}>
    <AlertDialogContent className="rounded-[28px]">
      <AlertDialogHeader>
        <AlertDialogTitle>Eliminar mensagem?</AlertDialogTitle>
        <AlertDialogDescription>
          A mensagem é apagada para todos os participantes e fica a indicação “Mensagem eliminada”.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
        <AlertDialogAction
          className="rounded-full bg-rose-600 hover:bg-rose-700"
          onClick={() => message && onConfirm(message)}
        >
          Eliminar
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
