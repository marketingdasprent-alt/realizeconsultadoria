import React, { useEffect, useRef, useState } from 'react';
import { Headset, Loader2, Paperclip, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { filesFromPaste, useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useNewTicket } from '../hooks/useMyTickets';
import { useTicketFiles } from '../hooks/useTicketFiles';
import { TICKET_FILE_ACCEPT, TICKET_MAX_FILES } from '../lib/ticketFiles';
import { TicketFileChips } from './TicketFileChips';

const LABEL = 'mb-2 block text-[13px] font-bold';
const CHIP = 'rounded-full px-4 py-2 text-[13px] font-semibold transition-colors';

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticketId: string) => void;
}

/** Novo pedido aos RH: equipa, assunto (da lista), descrição e anexos (arrastar ou escolher). */
export const NewTicketDialog: React.FC<NewTicketDialogProps> = ({
  open,
  onOpenChange,
  onCreated,
}) => {
  const { departments, subjects, isLoading, create } = useNewTicket(open);
  const [departmentId, setDepartmentId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const files = useTicketFiles();
  const input = useRef<HTMLInputElement>(null);
  const { isDragging, dropProps } = useFileDrop(files.add, open);

  useEffect(() => {
    if (open) return;
    setDepartmentId('');
    setSubjectId('');
    setMessage('');
    files.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- limpa só ao fechar
  }, [open]);

  const options = subjects.filter(s => s.department_id === departmentId);
  const subject = options.find(s => s.id === subjectId);
  const ready = !!departmentId && !!subject && message.trim().length > 0 && !busy;

  const submit = async () => {
    if (!subject) return;
    setBusy(true);
    const id = await create({ departmentId, subject, message, files: files.files });
    setBusy(false);
    if (!id) return;
    onOpenChange(false);
    onCreated(id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        onPaste={event => {
          const pasted = filesFromPaste(event);
          if (!pasted.length) return;
          event.preventDefault();
          files.add(pasted);
        }}
        {...dropProps}
        className="max-h-[94vh] overflow-y-auto rounded-[28px] sm:max-w-lg sm:rounded-[28px]"
      >
        <DropOverlay visible={isDragging} />
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-sky-600 text-white">
            <Headset className="h-6 w-6" />
          </span>
          <div>
            <DialogTitle className="text-xl font-extrabold">Novo pedido</DialogTitle>
            <DialogDescription className="text-[13px]">
              A equipa responde aqui no Realize e recebe uma notificação.
            </DialogDescription>
          </div>
        </div>

        {isLoading ? (
          <Loader2 className="mx-auto my-8 h-6 w-6 animate-spin text-rz-primary" />
        ) : (
          <div className="space-y-5">
            <div>
              <span className={LABEL}>Para que equipa?</span>
              <div className="flex flex-wrap gap-2">
                {departments.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setDepartmentId(d.id);
                      setSubjectId('');
                    }}
                    className={cn(
                      CHIP,
                      departmentId === d.id
                        ? 'bg-rz-ink text-white'
                        : 'bg-rz-canvas hover:bg-rz-primary-soft'
                    )}
                  >
                    {d.name}
                  </button>
                ))}
                {!departments.length && (
                  <p className="text-sm text-rz-muted">Não há equipas disponíveis.</p>
                )}
              </div>
            </div>

            {departmentId && (
              <div>
                <span className={LABEL}>Assunto</span>
                <div className="flex flex-wrap gap-2">
                  {options.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubjectId(s.id)}
                      className={cn(
                        CHIP,
                        subjectId === s.id
                          ? 'bg-rz-primary text-white'
                          : 'bg-rz-canvas hover:bg-rz-primary-soft'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                  {!options.length && (
                    <p className="text-sm text-rz-muted">Esta equipa ainda não tem assuntos.</p>
                  )}
                </div>
              </div>
            )}

            <label className="block">
              <span className={LABEL}>Descreva o pedido</span>
              <textarea
                value={message}
                onChange={event => setMessage(event.target.value)}
                rows={4}
                placeholder="Conte-nos o que precisa…"
                className="w-full rounded-2xl bg-rz-canvas px-4 py-3 text-sm outline-none ring-1 ring-transparent focus:bg-white focus:ring-rz-primary/40"
              />
            </label>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={files.files.length >= TICKET_MAX_FILES}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rz-line px-4 py-4 text-[13px] font-semibold text-rz-muted transition-colors hover:border-rz-primary/50 hover:text-rz-primary disabled:opacity-50"
              >
                <Paperclip className="h-4 w-4" /> Arraste ficheiros para aqui ou clique para
                escolher
              </button>
              <p className="text-center text-[11.5px] text-rz-muted">
                Imagens ou PDF · até {TICKET_MAX_FILES} ficheiros de 10 MB
              </p>
              <input
                ref={input}
                type="file"
                multiple
                accept={TICKET_FILE_ACCEPT}
                className="hidden"
                onChange={event => {
                  files.add(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
              <TicketFileChips files={files.files} onRemove={files.remove} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-11 rounded-full px-5 text-[14px] font-semibold text-rz-muted hover:bg-rz-canvas"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={submit}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar pedido
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
