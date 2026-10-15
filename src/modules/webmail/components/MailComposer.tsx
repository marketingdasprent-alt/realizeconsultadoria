import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, Paperclip, Send, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { parseRecipients, withSignature } from '../lib/mailFormat';
import type { ComposeDraft, ComposeInput, MailAccount } from '../types';

const MAX_BYTES = 10 * 1024 * 1024;
const FIELD = 'h-10 w-full bg-transparent text-[14px] outline-none placeholder:text-rz-muted';

interface MailComposerProps {
  draft: ComposeDraft | null;
  accounts: MailAccount[];
  onClose: () => void;
  onSend: (input: ComposeInput) => Promise<boolean>;
  toBase64: (file: File) => Promise<string>;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex items-center gap-3 border-b border-rz-line px-5">
    <span className="w-12 shrink-0 text-[13px] font-semibold text-rz-muted">{label}</span>
    {children}
  </label>
);

/** Escrever, responder ou reencaminhar (com assinatura da caixa e anexos até 10 MB). */
export const MailComposer: React.FC<MailComposerProps> = ({
  draft,
  accounts,
  onClose,
  onSend,
  toBase64,
}) => {
  const listId = useId();
  const { colleagues } = useDirectory();
  const fallback = accounts.find(a => a.isDefault) ?? accounts[0];
  const [accountId, setAccountId] = useState('');
  const [fields, setFields] = useState({ to: '', cc: '', bcc: '', subject: '', body: '' });
  const [showCc, setShowCc] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!draft) return;
    const list = accountsRef.current;
    const account =
      list.find(a => a.id === draft.accountId) ?? list.find(a => a.isDefault) ?? list[0];
    setAccountId(account?.id ?? '');
    setFields({
      to: draft.to ?? '',
      cc: draft.cc ?? '',
      bcc: '',
      subject: draft.subject ?? '',
      body: withSignature(draft.body ?? '', account?.signature ?? null),
    });
    setShowCc(!!draft.cc);
    setFiles([]);
    setBusy(false);
  }, [draft]);

  const set = (key: keyof typeof fields, value: string) => setFields(f => ({ ...f, [key]: value }));
  const size = files.reduce((total, file) => total + file.size, 0);
  const to = parseRecipients(fields.to);

  const send = async () => {
    if (!draft) return;
    setBusy(true);
    const ok = await onSend({
      accountId: accountId || fallback?.id || '',
      to,
      cc: parseRecipients(fields.cc),
      bcc: parseRecipients(fields.bcc),
      subject: fields.subject.trim(),
      text: fields.body,
      inReplyTo: draft.inReplyTo,
      attachments: await Promise.all(
        files.map(async file => ({
          filename: file.name,
          mime: file.type || 'application/octet-stream',
          base64: await toBase64(file),
        }))
      ),
    });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={!!draft} onOpenChange={open => !open && onClose()}>
      <DialogContent
        onInteractOutside={event => event.preventDefault()}
        className="flex max-h-[94vh] flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-2xl sm:rounded-[28px]"
      >
        <DialogTitle className="px-5 pb-3 pt-5 text-[18px] font-extrabold">
          {draft?.inReplyTo ? 'Responder' : 'Nova mensagem'}
        </DialogTitle>
        <Row label="De">
          <select value={accountId} onChange={e => setAccountId(e.target.value)} className={FIELD}>
            {accounts.map(account => (
              <option key={account.id} value={account.id}>
                {account.displayName ? `${account.displayName} <${account.email}>` : account.email}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Para">
          <input
            value={fields.to}
            onChange={e => set('to', e.target.value)}
            list={listId}
            className={FIELD}
            autoFocus
          />
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="text-[12.5px] font-bold text-rz-primary"
            >
              Cc/Bcc
            </button>
          )}
        </Row>
        {showCc && (
          <>
            <Row label="Cc">
              <input
                value={fields.cc}
                onChange={e => set('cc', e.target.value)}
                list={listId}
                className={FIELD}
              />
            </Row>
            <Row label="Bcc">
              <input
                value={fields.bcc}
                onChange={e => set('bcc', e.target.value)}
                list={listId}
                className={FIELD}
              />
            </Row>
          </>
        )}
        <datalist id={listId}>
          {colleagues
            .filter(c => c.email)
            .map(c => (
              <option key={c.userId} value={`${c.name} <${c.email}>`} />
            ))}
        </datalist>
        <Row label="Assunto">
          <input
            value={fields.subject}
            onChange={e => set('subject', e.target.value)}
            className={FIELD}
          />
        </Row>
        <textarea
          value={fields.body}
          onChange={e => set('body', e.target.value)}
          className="min-h-[240px] flex-1 resize-none px-5 py-4 text-[14px] leading-relaxed outline-none"
          placeholder="Escreva a sua mensagem…"
        />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-2 px-5 pb-2">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${index}`}
                className="flex items-center gap-1.5 rounded-full bg-rz-canvas py-1 pl-3 pr-1 text-[12.5px] font-semibold"
              >
                <span className="max-w-[180px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => setFiles(f => f.filter((_, i) => i !== index))}
                  className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
                  aria-label={`Remover ${file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex items-center gap-3 border-t border-rz-line px-5 py-3">
          <button
            type="button"
            disabled={busy || !to.length || size > MAX_BYTES || !accounts.length}
            onClick={send}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{' '}
            Enviar
          </button>
          <label
            className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas"
            aria-label="Anexar ficheiros"
          >
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              multiple
              className="hidden"
              onChange={e => setFiles(f => [...f, ...Array.from(e.target.files ?? [])])}
            />
          </label>
          {size > MAX_BYTES && (
            <span className="text-[12.5px] font-semibold text-rose-600">
              Anexos acima de 10 MB.
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
