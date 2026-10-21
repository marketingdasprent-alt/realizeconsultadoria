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

interface SendBroadcastDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  emails: number;
  appOnly: number;
  publishInApp: boolean;
  onConfirm: () => void;
}

/** Confirmação antes de enviar (não se pode desfazer). */
export const SendBroadcastDialog: React.FC<SendBroadcastDialogProps> = ({
  open,
  onOpenChange,
  subject,
  emails,
  appOnly,
  publishInApp,
  onConfirm,
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent className="font-jakarta">
      <AlertDialogHeader>
        <AlertDialogTitle>Enviar “{subject.trim()}”?</AlertDialogTitle>
        <AlertDialogDescription asChild>
          <div className="space-y-1 text-[14px]">
            <p>
              Vai por email a <strong>{emails}</strong> {emails === 1 ? 'pessoa' : 'pessoas'}.
            </p>
            {publishInApp && (
              <p>
                Fica também na app (Feed → Comunicados), com notificação no telemóvel
                {appOnly > 0 ? ` — e ${appOnly} sem email só o veem lá` : ''}.
              </p>
            )}
            <p>Depois de enviado não se pode anular.</p>
          </div>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Voltar</AlertDialogCancel>
        <AlertDialogAction onClick={onConfirm}>Enviar</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);
