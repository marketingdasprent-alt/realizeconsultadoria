import React from 'react';
import { EventDialog } from '@/modules/calendar/components/EventDialog';
import { useCreateEvent } from '@/modules/calendar/hooks/useCalendar';
import { TaskFormDialog } from '@/modules/tasks/components/TaskFormDialog';
import { useTasks } from '@/modules/tasks/hooks/useTasks';
import { htmlToText, nameOf } from '../lib/mailFormat';
import type { MailMessage } from '../types';

export interface MailConversion {
  kind: 'task' | 'event';
  message: MailMessage;
}

const describe = (message: MailMessage) =>
  `${(message.text ?? htmlToText(message.html ?? '')).trim().slice(0, 1500)}

— Email de ${nameOf(message.from)}`.trim();

/** Transformar um email em tarefa ou evento (briefing §9), com o assunto e o texto. */
export const MailToTaskOrEvent: React.FC<{
  value: MailConversion | null;
  onClose: () => void;
}> = ({ value, onClose }) => {
  const tasks = useTasks();
  const createEvent = useCreateEvent();
  const message = value?.message;
  const subject = (message?.subject || 'Email').slice(0, 120);

  return (
    <>
      <TaskFormDialog
        open={value?.kind === 'task'}
        onOpenChange={open => !open && onClose()}
        title="Criar tarefa a partir do email"
        initial={
          message
            ? {
                title: subject,
                description: describe(message),
                sourceType: 'email',
                sourceRef: `${message.accountId}:${message.id}`,
              }
            : undefined
        }
        onSave={tasks.create}
      />
      <EventDialog
        open={value?.kind === 'event'}
        onOpenChange={open => !open && onClose()}
        initial={message ? { title: subject, description: describe(message) } : undefined}
        onSave={createEvent}
      />
    </>
  );
};
