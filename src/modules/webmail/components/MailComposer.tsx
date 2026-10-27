import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Maximize2, Minus, Paperclip, Save, Send, Trash2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { attachmentClipboard, useCopiedAttachments } from '../lib/attachmentClipboard';
import { attachmentFile } from '../lib/attachments';
import { parseRecipients } from '../lib/mailFormat';
import { FORWARD_MARKER } from '../lib/forward';
import { signatureToHtml, writtenPart } from '../lib/signature';
import { checkBeforeSend, type SendCheck } from '../lib/sendCheck';
import { pickSignature, type SignatureChoice } from '../lib/signatures';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { filesFromPaste, useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useDraftSaver } from '../hooks/useDraftSaver';
import type { ContactEntry, ContactList } from '../lib/recipients';
import { draftHasContent, stripSavedSignature } from '../lib/savedDraft';
import type { ComposeDraft, ComposeInput, MailAccount } from '../types';
import { AutoTextarea } from './AutoTextarea';
import { RecipientField } from './RecipientField';
import { SendCheckDialog } from './SendCheckDialog';
import { RzSelect } from '@/modules/workspace/components/RzSelect';

const MAX_BYTES = 10 * 1024 * 1024;
const FIELD = 'h-10 w-full bg-transparent text-[14px] outline-none placeholder:text-rz-muted';

interface MailComposerProps {
  draft: ComposeDraft | null;
  accounts: MailAccount[];
  /** Quem a pessoa já escreveu e as suas listas (sugestões ao digitar). */
  contacts?: ContactEntry[];
  lists?: ContactList[];
  onClose: () => void;
  /** Minimizada (como o Gmail): fica uma barra em baixo com o rascunho guardado. */
  minimized?: boolean;
  onMinimize?: () => void;
  onRestore?: () => void;
  onSend: (input: ComposeInput) => Promise<boolean>;
  toBase64: (file: File) => Promise<string>;
}

/** Linha dos destinatários: não é <label> (as etiquetas têm botões lá dentro). */
const RecipientRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div className="flex items-start gap-3 border-b border-rz-line px-5">
    <span className="w-12 shrink-0 pt-[18px] text-[13px] font-semibold leading-none text-rz-muted">
      {label}
    </span>
    {children}
  </div>
);

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
  contacts = [],
  lists = [],
  onClose,
  minimized = false,
  onMinimize,
  onRestore,
  onSend,
  toBase64,
}) => {
  const { colleagues } = useDirectory();
  // Colegas da empresa com email: também são sugeridos.
  const team = useMemo<ContactEntry[]>(
    () =>
      colleagues
        .filter(person => person.email)
        .map(person => ({ email: person.email as string, name: person.name })),
    [colleagues]
  );
  const fallback = accounts.find(a => a.isDefault) ?? accounts[0];
  const [accountId, setAccountId] = useState('');
  const [fields, setFields] = useState({ to: '', cc: '', bcc: '', subject: '', body: '' });
  // Resposta/reencaminhamento: a citação fica à parte, depois da assinatura (como sai no email).
  const [quote, setQuote] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const addFiles = (added: File[]) => setFiles(current => [...current, ...added]);
  // Anexo copiado noutro email ("Copiar" no visualizador): oferece-se para colar aqui.
  const copied = useCopiedAttachments();
  const pasteCopied = () => {
    addFiles(attachmentClipboard.get());
    attachmentClipboard.clear();
  };
  const { isDragging, dropProps } = useFileDrop(addFiles);
  const [busy, setBusy] = useState(false);
  // Assinatura escolhida: a predefinida da caixa, nenhuma, ou uma das outras.
  const [sigChoice, setSigChoice] = useState<SignatureChoice>('default');
  // Reencaminhar: anexos do original a ser buscados (e os que não vieram).
  const [loadingFiles, setLoadingFiles] = useState(0);
  const [missingFiles, setMissingFiles] = useState<string[]>([]);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!draft) return;
    const list = accountsRef.current;
    const account =
      list.find(a => a.id === draft.accountId) ?? list.find(a => a.isDefault) ?? list[0];
    setAccountId(account?.id ?? '');
    // Rascunho reaberto: a assinatura sai do texto e volta ao seletor (completa, com imagens).
    let written = writtenPart(draft.body ?? '');
    let choice: SignatureChoice = 'default';
    if (draft.saved) {
      const signatures = account?.signatures ?? [];
      const found = stripSavedSignature(written, signatures);
      written = found.body;
      choice = !found.signatureId
        ? 'none'
        : signatures.find(sig => sig.id === found.signatureId)?.isDefault
          ? 'default'
          : found.signatureId;
    }
    setFields({
      to: draft.to ?? '',
      cc: draft.cc ?? '',
      bcc: draft.bcc ?? '',
      subject: draft.subject ?? '',
      body: written,
    });
    setQuote((draft.body ?? '').slice(writtenPart(draft.body ?? '').length));
    setShowCc(!!draft.cc || !!draft.bcc);
    setSigChoice(choice);
    setFiles([]);
    setMissingFiles([]);
    setBusy(false);

    // Reencaminhar o email todo: os anexos do original voltam a anexar-se (um a um, em fundo).
    const forward = draft.forward ?? draft.saved ?? draft.attach;
    if (!forward?.attachments.length) {
      setLoadingFiles(0);
      return;
    }
    let cancelled = false;
    setLoadingFiles(forward.attachments.length);
    void (async () => {
      for (const attachment of forward.attachments) {
        try {
          const file = await attachmentFile(
            forward.accountId,
            forward.messageId,
            attachment.id,
            attachment.filename
          );
          if (!cancelled) setFiles(current => [...current, file]);
        } catch {
          if (!cancelled) setMissingFiles(current => [...current, attachment.filename]);
        }
        if (!cancelled) setLoadingFiles(current => current - 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  const set = (key: keyof typeof fields, value: string) => setFields(f => ({ ...f, [key]: value }));
  const size = files.reduce((total, file) => total + file.size, 0);
  const to = parseRecipients(fields.to);
  const sender = accounts.find(a => a.id === (accountId || fallback?.id));
  const signatures = sender?.signatures ?? [];
  const signature = pickSignature(signatures, sigChoice);
  const signatureHtml = signatureToHtml(signature?.html ?? null);

  const buildInput = async (): Promise<ComposeInput> => ({
    accountId: accountId || fallback?.id || '',
    to,
    cc: parseRecipients(fields.cc),
    bcc: parseRecipients(fields.bcc),
    subject: fields.subject.trim(),
    text: fields.body + quote,
    signatureHtml: signatureHtml || null,
    // Só enquanto a citação do reencaminhamento ainda lá está (se a apagou, vai o que escreveu).
    quotedHtml:
      draft?.forward && quote.includes(FORWARD_MARKER)
        ? draft.forward.html
        : // Resposta: o original em HTML, enquanto a citação lá estiver.
          draft?.replyHtml && /escreveu:/.test(quote)
          ? draft.replyHtml
          : null,
    inReplyTo: draft?.inReplyTo,
    attachments: await Promise.all(
      files.map(async file => ({
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        base64: await toBase64(file),
      }))
    ),
  });

  // Rascunho: guarda sozinho depois de cada alteração, e já ao fechar ou minimizar.
  const hasContent = draftHasContent(fields, files.length);
  const snapshot = JSON.stringify([
    fields,
    quote,
    accountId,
    sigChoice,
    files.map(file => [file.name, file.size]),
  ]);
  const initialSaved = useMemo(
    () => (draft?.saved ? { id: draft.saved.messageId, accountId: draft.saved.accountId } : null),
    [draft?.saved]
  );
  const saver = useDraftSaver({
    open: !!draft,
    snapshot,
    hasContent,
    initial: initialSaved,
    build: buildInput,
  });
  const close = async () => {
    // Fechar sem mexer em nada (ex.: abriu uma resposta e desistiu) não cria rascunho.
    if (!hasContent || loadingFiles > 0 || !saver.isDirty()) return onClose();
    const ok = await saver.flush();
    onClose();
    toast(
      ok
        ? { title: 'Rascunho guardado', description: 'Está na pasta Rascunhos.' }
        : { title: 'O rascunho não foi guardado', variant: 'destructive' }
    );
  };
  const minimize = () => {
    void saver.flush();
    onMinimize?.();
  };
  const discard = async () => {
    await saver.discard();
    onClose();
  };
  const savedLabel =
    saver.status === 'saving'
      ? 'A guardar…'
      : saver.status === 'error'
        ? 'Rascunho não guardado'
        : saver.savedAt
          ? `Guardado às ${saver.savedAt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
          : '';

  // Antes de enviar: sem destinatário não segue; sem assunto/texto pergunta-se.
  const [check, setCheck] = useState<SendCheck | null>(null);
  const send = () => {
    const result = checkBeforeSend({
      to,
      cc: parseRecipients(fields.cc),
      bcc: parseRecipients(fields.bcc),
      subject: fields.subject,
      written: writtenPart(fields.body),
      attachments: files.length,
    });
    if (result.blocked || result.missing.length) return setCheck(result);
    void sendNow();
  };

  const sendNow = async () => {
    if (!draft) return;
    setBusy(true);
    saver.stop();
    const saved = saver.current();
    const input: ComposeInput = { ...(await buildInput()), draft: saved ?? undefined };
    setBusy(false);
    // Fecha logo; o envio continua em segundo plano (se falhar, o rascunho volta a abrir).
    onClose();
    void onSend(input);
  };

  const title = draft?.inReplyTo ? 'Responder' : 'Nova mensagem';

  return (
    <>
      {draft && minimized && (
        <div className="fixed bottom-0 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] items-center gap-1 rounded-t-2xl bg-rz-ink px-4 py-2.5 text-white shadow-rz-pop">
          <button
            type="button"
            onClick={onRestore}
            className="min-w-0 flex-1 truncate text-left text-[14px] font-bold"
            title="Abrir a mensagem"
          >
            {fields.subject.trim() || title}
          </button>
          <button
            type="button"
            onClick={onRestore}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15"
            aria-label="Abrir a mensagem"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void close()}
            className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15"
            aria-label="Descartar a mensagem"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Dialog open={!!draft && !minimized} onOpenChange={open => !open && void close()}>
        <DialogContent
          onInteractOutside={event => event.preventDefault()}
          onPaste={event => {
            const pasted = filesFromPaste(event);
            if (!pasted.length) {
              // Ctrl+V sem ficheiros no sistema: cola o anexo copiado no Realize (se houver).
              if (copied.length && !event.clipboardData.getData('text')) {
                event.preventDefault();
                pasteCopied();
              }
              return;
            }
            event.preventDefault();
            addFiles(pasted);
          }}
          {...dropProps}
          className="flex h-[min(92vh,920px)] w-[min(96vw,1120px)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-none sm:rounded-[28px]"
        >
          <DropOverlay visible={isDragging} />
          {onMinimize && (
            <button
              type="button"
              onClick={minimize}
              className="absolute right-12 top-4 flex h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
              aria-label="Minimizar"
              title="Minimizar"
            >
              <Minus className="h-4 w-4" />
            </button>
          )}
          <DialogTitle className="px-5 pb-3 pt-5 text-[18px] font-extrabold">{title}</DialogTitle>
          <Row label="De">
            <RzSelect
              value={accountId}
              onChange={value => {
                setAccountId(value);
                setSigChoice('default');
              }}
              className={FIELD}
              ariaLabel="De"
              options={accounts.map(account => ({
                value: account.id,
                label: account.displayName
                  ? `${account.displayName} <${account.email}>`
                  : account.email,
              }))}
            />
            {signatures.length > 0 && (
              <RzSelect
                value={sigChoice}
                onChange={setSigChoice}
                ariaLabel="Assinatura"
                title="Assinatura"
                align="end"
                className="h-8 max-w-[13rem] shrink-0 rounded-full bg-rz-canvas px-3 text-[12.5px] font-semibold text-rz-ink ring-1 ring-rz-line"
                options={[
                  {
                    value: 'default',
                    label: signatures.find(sig => sig.isDefault)?.name
                      ? `Assinatura: ${signatures.find(sig => sig.isDefault)?.name}`
                      : 'Sem assinatura',
                  },
                  ...signatures
                    .filter(sig => !sig.isDefault)
                    .map(sig => ({ value: sig.id, label: `Assinatura: ${sig.name}` })),
                  { value: 'none', label: 'Sem assinatura' },
                ]}
              />
            )}
          </Row>
          <RecipientRow label="Para">
            <RecipientField
              value={fields.to}
              onChange={value => set('to', value)}
              team={team}
              contacts={contacts}
              lists={lists}
              label="Para"
              placeholder="Nome, email ou lista"
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
          </RecipientRow>
          {showCc && (
            <>
              <RecipientRow label="Cc">
                <RecipientField
                  value={fields.cc}
                  onChange={value => set('cc', value)}
                  team={team}
                  contacts={contacts}
                  lists={lists}
                  label="Cc"
                />
              </RecipientRow>
              <RecipientRow label="Bcc">
                <RecipientField
                  value={fields.bcc}
                  onChange={value => set('bcc', value)}
                  team={team}
                  contacts={contacts}
                  lists={lists}
                  label="Bcc"
                />
              </RecipientRow>
            </>
          )}
          <Row label="Assunto">
            <input
              value={fields.subject}
              onChange={e => set('subject', e.target.value)}
              className={FIELD}
            />
          </Row>
          <div className="rz-scroll min-h-[160px] flex-1 overflow-y-auto px-5 py-4 text-[14.5px] leading-relaxed">
            <AutoTextarea
              value={fields.body}
              onChange={e => set('body', e.target.value)}
              placeholder="Escreva a sua mensagem…"
              className="min-h-[96px]"
            />
            {signatureHtml && (
              // Já limpa (sem scripts nem eventos): é a assinatura da própria pessoa. Muda-se em cima.
              <div
                className="mt-3 text-[13.5px] [&_img]:inline-block"
                dangerouslySetInnerHTML={{ __html: signatureHtml }}
              />
            )}
            {quote && (
              <AutoTextarea
                value={quote.replace(/^\n+/, '')}
                onChange={e => setQuote(`\n\n${e.target.value}`)}
                aria-label="Mensagem original"
                className="mt-4 border-l-2 border-rz-line pl-3 text-[13.5px] text-rz-muted"
              />
            )}
          </div>
          {(loadingFiles > 0 || missingFiles.length > 0) && (
            <div className="px-5 pb-2 text-[12.5px] font-semibold">
              {loadingFiles > 0 && (
                <p className="flex items-center gap-2 text-rz-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> A juntar os anexos do email
                  original…
                </p>
              )}
              {missingFiles.length > 0 && (
                <p className="text-rose-600">
                  Não foi possível juntar: {missingFiles.join(', ')}. Pode anexá-los à mão.
                </p>
              )}
            </div>
          )}
          {copied.length > 0 && (
            <div className="mx-5 mb-2 flex items-center gap-2 rounded-2xl bg-rz-primary-soft px-3 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate">
                📎 <b>{copied.map(file => file.name).join(', ')}</b> copiado
              </span>
              <button
                type="button"
                onClick={pasteCopied}
                className="h-7 shrink-0 rounded-full bg-rz-primary px-3 text-[12px] font-bold text-white"
              >
                Colar
              </button>
              <button
                type="button"
                onClick={attachmentClipboard.clear}
                className="h-7 shrink-0 rounded-full px-2 text-[12px] font-semibold text-rz-muted hover:bg-white"
              >
                Ignorar
              </button>
            </div>
          )}
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
          <div className="flex items-center gap-2 border-t border-rz-line px-5 py-3">
            <label
              className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas"
              aria-label="Anexar ficheiros"
            >
              <Paperclip className="h-5 w-5" />
              <input
                type="file"
                multiple
                className="hidden"
                onChange={e => addFiles(Array.from(e.target.files ?? []))}
              />
            </label>
            <button
              type="button"
              onClick={() => void saver.save()}
              disabled={!hasContent || saver.status === 'saving' || loadingFiles > 0}
              title="Guardar rascunho"
              aria-label="Guardar rascunho"
              className="flex h-10 w-10 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-primary disabled:opacity-40"
            >
              <Save className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => void discard()}
              title="Descartar"
              aria-label="Descartar a mensagem"
              className="flex h-10 w-10 items-center justify-center rounded-full text-rz-muted hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <span className="truncate text-[12px] text-rz-muted">{savedLabel}</span>
            {size > MAX_BYTES && (
              <span className="text-[12.5px] font-semibold text-rose-600">
                Anexos acima de 10 MB.
              </span>
            )}
            <button
              type="button"
              disabled={busy || loadingFiles > 0 || size > MAX_BYTES || !accounts.length}
              onClick={send}
              className="ml-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{' '}
              Enviar
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <SendCheckDialog
        check={check}
        onSend={() => {
          setCheck(null);
          void sendNow();
        }}
        onClose={() => setCheck(null)}
      />
    </>
  );
};
