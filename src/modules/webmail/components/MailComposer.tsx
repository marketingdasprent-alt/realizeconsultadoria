import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '@/modules/workspace/context/workspaceContext';
import {
  AppWindow,
  Loader2,
  Maximize2,
  Minus,
  Paperclip,
  PictureInPicture2,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useDirectory } from '@/modules/social/hooks/useDirectory';
import { attachmentClipboard, useCopiedAttachments } from '../lib/attachmentClipboard';
import { attachmentFile } from '../lib/attachments';
import { MAIL_FONT, parseRecipients } from '../lib/mailFormat';
import { FORWARD_MARKER } from '../lib/forward';
import { signatureToHtml, writtenPart } from '../lib/signature';
import { checkBeforeSend, type SendCheck } from '../lib/sendCheck';
import { pickSignature, type SignatureChoice } from '../lib/signatures';
import { AiRewriteBar } from './AiRewriteBar';
import { DropOverlay } from '@/modules/workspace/components/DropOverlay';
import { filesFromPaste, useFileDrop } from '@/modules/workspace/hooks/useFileDrop';
import { useDraftSaver } from '../hooks/useDraftSaver';
import { mailService } from '../services/mailService';
import { useAiRewrite } from '../hooks/useAiRewrite';
import { useFloatingWindow } from '../hooks/useFloatingWindow';
import { useWindowPopout } from '../hooks/useWindowPopout';
import { PortalContainerContext } from '@/lib/portalContainer';
import { createPortal } from 'react-dom';
import { composeSession } from '../lib/composeSession';
import type { ContactEntry, ContactList } from '../lib/recipients';
import { draftHasContent, stripSavedSignature } from '../lib/savedDraft';
import type { ComposeDraft, ComposeInput, MailAccount, RemoteAttachments } from '../types';
import { AutoTextarea } from './AutoTextarea';
import { RecipientField } from './RecipientField';
import { SendCheckDialog } from './SendCheckDialog';
import { RzSelect } from '@/modules/workspace/components/RzSelect';

const MAX_BYTES = 10 * 1024 * 1024;
/** Total com os anexos do email original (juntos pelo servidor ao enviar). */
// Igual ao servidor: 18 MB de ficheiros ficam ~25 MB depois de codificados no email
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
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
  /** `asItWas`: o email como estava, para reabrir se o envio for anulado. */
  onSend: (input: ComposeInput, asItWas: ComposeDraft) => Promise<boolean>;
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
  // App de email para clientes de fora: sem o "Usar IA" (é da Realize)
  const { mailOnly } = useWorkspace();
  // Janela solta (arrastável, sem bloquear a página) para abrir outros emails enquanto se escreve.
  // Arrastar a janela para fora do navegador abre-a noutra janela, onde se largou.
  const win = useFloatingWindow(!!draft, at =>
    openPopout({ left: at.screenX - 120, top: at.screenY - 24 })
  );
  // Janela própria do navegador (para levar a mensagem a outro monitor).
  const [popped, setPopped] = useState(false);
  // A janela nova fechou (X do sistema ou "Trazer de volta"): a mensagem volta, grande e ao centro.
  const popout = useWindowPopout(!!draft, () => {
    setPopped(false);
    win.undock();
  });
  useEffect(() => {
    if (!draft) setPopped(false);
  }, [draft]);
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
  // A citação como abriu: o HTML original (replyHtml / forward.html) só vai se não mudou.
  const [originalQuote, setOriginalQuote] = useState('');
  const [showCc, setShowCc] = useState(false);
  // Texto por passar a etiqueta em cada campo (um endereço mal escrito não pode sumir calado).
  const [unparsed, setUnparsed] = useState({ to: '', cc: '', bcc: '' });
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
  // Reencaminhar: anexos do original, que ficam na caixa e o servidor junta ao enviar
  const [remote, setRemote] = useState<RemoteAttachments | null>(null);
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (!draft) return;
    const list = accountsRef.current;
    const account =
      list.find(a => a.id === draft.accountId) ?? list.find(a => a.isDefault) ?? list[0];
    setAccountId(account?.id ?? '');
    // Voltou ao Email com uma mensagem a meio: fica tudo como estava.
    if (draft.resume) {
      setFields({
        to: draft.to ?? '',
        cc: draft.cc ?? '',
        bcc: draft.bcc ?? '',
        subject: draft.subject ?? '',
        body: draft.body ?? '',
      });
      setQuote(draft.resume.quote);
      setOriginalQuote(draft.resume.originalQuote ?? draft.resume.quote);
      setShowCc(draft.resume.showCc);
      setSigChoice(draft.resume.signature);
      setFiles(draft.resume.files);
      setRemote(draft.resume.remote ?? null);
      setMissingFiles([]);
      setLoadingFiles(0);
      setBusy(false);
      return;
    }
    // Rascunho reaberto: a assinatura sai do texto e volta ao seletor (completa, com imagens).
    let written = writtenPart(draft.body ?? '');
    let choice: SignatureChoice = 'default';
    if (draft.saved) {
      const signatures = account?.signatures ?? [];
      const found = stripSavedSignature(written, signatures);
      written = found.body;
      // A escolhida quando foi guardado; senão a encontrada no texto. Não encontrada (ex.: só
      // com imagem, sem texto): fica a predefinida — antes reabria "Sem assinatura".
      choice = draft.saved.signature
        ? draft.saved.signature
        : !found.signatureId
          ? 'default'
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
    const opened = (draft.body ?? '').slice(writtenPart(draft.body ?? '').length);
    setQuote(opened);
    setOriginalQuote(opened);
    setShowCc(!!draft.cc || !!draft.bcc);
    setSigChoice(choice);
    setFiles([]);
    setRemote(null);
    setMissingFiles([]);
    setBusy(false);

    // Reencaminhar (ou "Novo email com anexo"): os anexos do original ficam na caixa e o
    // servidor junta-os ao enviar — o compositor abre logo, sem os descarregar um a um.
    const source = draft.forward ?? draft.attach;
    if (source?.attachments.length) {
      setRemote({
        accountId: source.accountId,
        messageId: source.messageId,
        items: source.attachments,
      });
      setLoadingFiles(0);
      // Rascunho de um reencaminhamento: os anexos que se juntaram à mão também voltam
      if (!draft.saved?.attachments.length) return;
    }
    // Rascunho reaberto: os anexos voltam a anexar-se (um a um, em fundo).
    const forward = draft.saved;
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
  // "Usar IA": continua com a janela minimizada (o pedido vive aqui, não no botão).
  const minimizedRef = useRef(minimized);
  minimizedRef.current = minimized;
  const ai = useAiRewrite(result => {
    setFields(f => ({ ...f, body: result.text, subject: result.subject }));
    if (minimizedRef.current)
      toast({ title: 'A IA terminou o email', description: 'Abra a mensagem para rever.' });
  });
  const size = files.reduce((total, file) => total + file.size, 0);
  const remoteItems = remote?.items ?? [];
  const remoteSize = remoteItems.reduce((total, item) => total + item.size, 0);
  const attachmentCount = files.length + remoteItems.length;
  const totalSize = size + remoteSize;
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
    // O original em HTML (com imagens) só se a citação ficou como abriu: se a pessoa escreveu
    // no meio dela ou a cortou, vai o texto tal como está (senão as respostas perdiam-se).
    quotedHtml:
      quote.trim() && quote === originalQuote
        ? draft?.forward && quote.includes(FORWARD_MARKER)
          ? draft.forward.html
          : draft?.replyHtml && /escreveu:/.test(quote)
            ? draft.replyHtml
            : null
        : null,
    // Só com a mesma caixa do original: o id é dessa caixa (noutra conta respondia ao email
    // errado ou o Microsoft recusava o envio)
    inReplyTo:
      draft?.inReplyTo && (accountId || fallback?.id) === draft.accountId
        ? draft.inReplyTo
        : undefined,
    remoteAttachments: remote && remote.items.length ? remote : undefined,
    attachments: await Promise.all(
      files.map(async file => ({
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        base64: await toBase64(file),
      }))
    ),
  });

  // Rascunho: guarda sozinho depois de cada alteração, e já ao fechar ou minimizar.
  const hasContent = draftHasContent(fields, attachmentCount);
  const snapshot = JSON.stringify([
    fields,
    quote,
    accountId,
    sigChoice,
    files.map(file => [file.name, file.size]),
    remoteItems.map(item => item.id),
  ]);
  const initialSaved = useMemo(
    () =>
      draft?.resume
        ? draft.resume.saved
        : draft?.saved
          ? { id: draft.saved.messageId, accountId: draft.saved.accountId }
          : null,
    [draft?.saved, draft?.resume]
  );
  const saver = useDraftSaver({
    open: !!draft,
    snapshot,
    hasContent,
    attachmentBytes: size,
    initial: initialSaved,
    build: buildInput,
    resetKey: draft,
    meta: () => ({
      bcc: fields.bcc || undefined,
      inReplyTo: draft?.inReplyTo,
      replyHtml: draft?.replyHtml,
      forward: draft?.forward ? { ...draft.forward, attachments: remote?.items ?? [] } : undefined,
      remote: draft?.forward ? undefined : remote,
      signature: sigChoice,
    }),
    // Rascunho reaberto: só grava depois de os anexos voltarem todos (senão perdia os que faltavam)
    paused: loadingFiles > 0,
  });
  // Guarda a mensagem como está, para não se perder ao ir a outra página da app e voltar.
  const saverRef = useRef(saver);
  saverRef.current = saver;
  useEffect(() => {
    if (!draft) return;
    // Ainda sem nada escrito: não vale a pena reabrir.
    if (!hasContent) return composeSession.set(null);
    composeSession.set({
      ...draft,
      accountId: accountId || draft.accountId,
      to: fields.to,
      cc: fields.cc,
      bcc: fields.bcc,
      subject: fields.subject,
      body: fields.body,
      resume: {
        quote,
        originalQuote,
        signature: sigChoice,
        showCc,
        files,
        remote,
        saved: saverRef.current.current(),
      },
    });
  }, [draft, hasContent, accountId, fields, quote, sigChoice, showCc, files, remote, saver.status]);

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
      attachments: attachmentCount,
      unparsed: [
        { label: 'Para', text: unparsed.to },
        { label: 'Cc', text: unparsed.cc },
        { label: 'Bcc', text: unparsed.bcc },
      ],
    });
    if (result.blocked || result.invalid.length || result.missing.length || result.warnings.length)
      return setCheck(result);
    void sendNow();
  };

  const sendNow = async () => {
    if (!draft) return;
    setBusy(true);
    saver.stop();
    // Se estava a guardar o rascunho, espera no máximo 2 s: com anexos grandes num servidor
    // lento a gravação pode demorar minutos e o envio não fica preso atrás dela.
    const pending = saver.settled();
    await Promise.race([pending, new Promise(resolve => setTimeout(resolve, 2000))]);
    const saved = saver.current();
    // Se a gravação acabar depois do envio, o rascunho que ela criou é apagado (não fica lixo)
    void pending.then(() => {
      const late = saver.current();
      if (late && late.id !== saved?.id) void mailService.deleteDraft(late.accountId, late.id);
    });
    const input: ComposeInput = {
      ...(await buildInput()),
      draft: saved ?? undefined,
      forwardOf: draft.forward
        ? { messageId: draft.forward.messageId, messageKey: draft.forward.messageKey ?? null }
        : undefined,
    };
    // O email tal como está (com os anexos), para voltar a abrir se a pessoa anular o envio
    const asItWas: ComposeDraft = {
      ...draft,
      accountId: accountId || draft.accountId,
      to: fields.to,
      cc: fields.cc,
      bcc: fields.bcc,
      subject: fields.subject,
      body: fields.body,
      resume: { quote, originalQuote, signature: sigChoice, showCc, files, remote, saved },
    };
    setBusy(false);
    // Fecha logo; o envio continua em segundo plano (se falhar, o rascunho volta a abrir).
    onClose();
    void onSend(input, asItWas);
  };

  const title = draft?.inReplyTo ? 'Responder' : 'Nova mensagem';

  const onPaste = (event: React.ClipboardEvent) => {
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
  };

  const openPopout = (at?: { left: number; top: number }) => {
    void saver.flush();
    if (popout.open(at)) setPopped(true);
    else
      toast({
        title: 'O navegador bloqueou a janela nova',
        description: 'Permita janelas pop-up para este site, ou use o botão "Abrir noutra janela".',
        variant: 'destructive',
      });
  };

  const content = (
    <>
      <DropOverlay visible={isDragging} />
      {popped ? (
        <>
          <div className="absolute right-4 top-4 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => popout.close() /* volta à janela principal */}
              className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
              title="Trazer a mensagem de volta para a janela principal"
            >
              <Maximize2 className="h-3.5 w-3.5" /> Trazer de volta
            </button>
            <button
              type="button"
              onClick={() => void close()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
              aria-label="Fechar a mensagem"
              title="Fechar (o rascunho fica guardado)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <h2 className="pb-3 pl-5 pr-56 pt-5 text-[18px] font-extrabold">{title}</h2>
        </>
      ) : (
        <>
          <div className="absolute right-12 top-4 z-10 flex items-center gap-1">
            <button
              type="button"
              onClick={() => openPopout()}
              className="hidden h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink sm:flex"
              aria-label="Abrir noutra janela"
              title="Abrir noutra janela (para levar a outro monitor)"
            >
              <AppWindow className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={win.floating ? win.undock : win.dock}
              className="hidden h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink sm:flex"
              aria-label={win.floating ? 'Janela grande' : 'Soltar a janela'}
              title={
                win.floating
                  ? 'Voltar à janela grande'
                  : 'Soltar a janela (também se arrasta pela barra de título)'
              }
            >
              {win.floating ? (
                <Maximize2 className="h-4 w-4" />
              ) : (
                <PictureInPicture2 className="h-4 w-4" />
              )}
            </button>
            {onMinimize && (
              <button
                type="button"
                onClick={minimize}
                className="flex h-7 w-7 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-ink"
                aria-label="Minimizar"
                title="Minimizar"
              >
                <Minus className="h-4 w-4" />
              </button>
            )}
          </div>
          {/* Barra de título: pega-se aqui para arrastar a janela para outro lugar. */}
          <div
            {...win.handleProps}
            title="Arraste para mover. Arraste para fora do navegador para abrir noutra janela."
            className="select-none pr-36 sm:cursor-grab sm:active:cursor-grabbing"
          >
            <DialogTitle className="px-5 pb-3 pt-5 text-[18px] font-extrabold">{title}</DialogTitle>
          </div>
        </>
      )}
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
          onDraftChange={text => setUnparsed(u => ({ ...u, to: text }))}
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
              onDraftChange={text => setUnparsed(u => ({ ...u, cc: text }))}
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
              onDraftChange={text => setUnparsed(u => ({ ...u, bcc: text }))}
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
      <div
        className="rz-scroll min-h-[160px] flex-1 overflow-y-auto px-5 py-4 text-[14.5px] leading-relaxed"
        // A mesma letra com que o email sai (e a das assinaturas).
        style={{ fontFamily: MAIL_FONT }}
      >
        <AutoTextarea
          value={fields.body}
          onChange={e => set('body', e.target.value)}
          placeholder="Escreva a sua mensagem…"
          className="min-h-[96px]"
        />
        {!mailOnly && (
          <AiRewriteBar
            empty={!fields.body.trim()}
            busy={ai.busy}
            canUndo={!!ai.undoFor(fields.body)}
            onRun={mode => void ai.run(mode, { text: fields.body, subject: fields.subject }, quote)}
            onUndo={() => {
              const before = ai.undoFor(fields.body);
              if (before) setFields(f => ({ ...f, body: before.text, subject: before.subject }));
              ai.clearUndo();
            }}
          />
        )}
        {signatureHtml && (
          // Já limpa (sem scripts nem eventos): é a assinatura da própria pessoa. Muda-se em cima.
          <div
            className="rz-keep-light mt-3 rounded-xl text-[13.5px] dark:bg-white dark:p-3 [&_img]:inline-block"
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> A juntar os anexos do email original…
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
      {attachmentCount > 0 && (
        // Muitos anexos: a lista desliza dentro de uma altura fixa, para os botões (Enviar)
        // ficarem sempre à vista no fundo da janela
        <ul
          className="rz-scroll flex max-h-[7.5rem] shrink-0 flex-wrap gap-2 overflow-y-auto border-t border-rz-line px-5 py-2"
          aria-label={`${attachmentCount} anexos`}
        >
          {remoteItems.map(item => (
            <li
              key={`remote-${item.id}`}
              className="flex items-center gap-1.5 rounded-full bg-rz-canvas py-1 pl-3 pr-1 text-[12.5px] font-semibold"
              title="Anexo do email original (junta-se ao enviar)"
            >
              <span className="max-w-[180px] truncate">{item.filename}</span>
              <button
                type="button"
                onClick={() =>
                  setRemote(current =>
                    current
                      ? { ...current, items: current.items.filter(i => i.id !== item.id) }
                      : current
                  )
                }
                className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white"
                aria-label={`Remover ${item.filename}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
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
      <div className="flex shrink-0 items-center gap-2 border-t border-rz-line px-5 py-3">
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
        {attachmentCount > 0 && (
          <span className="shrink-0 text-[12px] font-semibold text-rz-muted">
            {attachmentCount === 1 ? '1 anexo' : `${attachmentCount} anexos`} ·{' '}
            {(totalSize / (1024 * 1024)).toFixed(1).replace('.', ',')} MB
          </span>
        )}
        {(size > MAX_BYTES || totalSize > MAX_TOTAL_BYTES) && (
          <span className="text-[12.5px] font-semibold text-rose-600">
            {size > MAX_BYTES
              ? 'Anexos novos acima de 10 MB.'
              : 'Anexos acima de 18 MB (no email ficam com mais de 25 MB, o limite dos servidores).'}
          </span>
        )}
        <button
          type="button"
          disabled={
            busy ||
            loadingFiles > 0 ||
            size > MAX_BYTES ||
            totalSize > MAX_TOTAL_BYTES ||
            !accounts.length
          }
          onClick={send}
          className="ml-auto inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-rz-primary px-6 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{' '}
          Enviar
        </button>
      </div>
    </>
  );

  return (
    <>
      {draft && minimized && !popped && (
        <div className="fixed bottom-0 right-4 z-50 flex w-[min(320px,calc(100vw-2rem))] items-center gap-1 rounded-t-2xl bg-rz-ink px-4 py-2.5 text-white shadow-rz-pop">
          <button
            type="button"
            onClick={onRestore}
            className="min-w-0 flex-1 truncate text-left text-[14px] font-bold"
            title="Abrir a mensagem"
          >
            {ai.busy && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
            {ai.busy ? 'A IA está a escrever…' : fields.subject.trim() || title}
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
      {draft && popped && (
        <div className="fixed bottom-0 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] items-center gap-2 rounded-t-2xl bg-rz-ink px-4 py-2.5 text-white shadow-rz-pop">
          <span className="min-w-0 flex-1 truncate text-[14px] font-bold">
            {fields.subject.trim() || title} (noutra janela)
          </span>
          <button
            type="button"
            onClick={() => popout.close()}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-[13px] font-semibold hover:bg-white/25"
          >
            Trazer de volta
          </button>
        </div>
      )}
      {draft &&
        popped &&
        popout.container &&
        createPortal(
          <PortalContainerContext.Provider value={popout.container}>
            <div
              {...dropProps}
              onPaste={onPaste}
              className="relative flex h-full w-full flex-col overflow-hidden bg-background text-foreground"
            >
              {content}
            </div>
          </PortalContainerContext.Provider>,
          popout.container
        )}
      <Dialog
        open={!!draft && !minimized && !popped}
        modal={!win.floating}
        onOpenChange={open => !open && void close()}
      >
        <DialogContent
          onInteractOutside={event => event.preventDefault()}
          // Solta, a janela convive com a página: só o Esc de dentro dela a fecha.
          onEscapeKeyDown={event => {
            if (win.floating && !(event.target as Element | null)?.closest?.('[role="dialog"]'))
              event.preventDefault();
          }}
          style={win.style}
          {...win.panelProps}
          onPaste={onPaste}
          {...dropProps}
          className={cn(
            'flex h-[min(92vh,920px)] w-[min(96vw,1120px)] max-w-none flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-none sm:rounded-[28px]',
            win.floating && 'border-rz-line shadow-rz-pop transition-none [will-change:transform]'
          )}
        >
          {content}
        </DialogContent>
      </Dialog>
      <PortalContainerContext.Provider value={popped ? popout.container : null}>
        <SendCheckDialog
          check={check}
          onSend={() => {
            setCheck(null);
            void sendNow();
          }}
          onClose={() => setCheck(null)}
        />
      </PortalContainerContext.Provider>
    </>
  );
};
