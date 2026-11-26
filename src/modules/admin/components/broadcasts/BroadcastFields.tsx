import React, { useRef } from 'react';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Paperclip,
  Smartphone,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { insertAtCursor } from '@/lib/insertAtCursor';
import { EmojiPicker } from '@/modules/messenger/components/EmojiPicker';
import type { BroadcastDraft, BroadcastErrors } from '../../lib/broadcast';
import { applyFormat, type FormatAction } from '../../lib/broadcastFormat';
import type { BroadcastAttachment } from '../../services/broadcastService';
import { BroadcastAi } from './BroadcastAi';
import { BroadcastSignaturePicker } from './BroadcastSignaturePicker';
import type { BroadcastSignature } from '../../services/broadcastService';

interface BroadcastFieldsProps {
  draft: BroadcastDraft;
  errors: BroadcastErrors;
  onChange: (patch: Partial<BroadcastDraft>) => void;
  signatures: BroadcastSignature[];
  attachments: BroadcastAttachment[];
  uploading: boolean;
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (path: string) => void;
  publishInApp: boolean;
  onPublishInApp: (value: boolean) => void;
  sendEmail: boolean;
  onSendEmail: (value: boolean) => void;
}

const Field: React.FC<{ id: string; label: string; error?: string; children: React.ReactNode }> = ({
  id,
  label,
  error,
  children,
}) => (
  <div className="space-y-1.5">
    <Label htmlFor={id} className="text-[13px] font-semibold">
      {label}
    </Label>
    {children}
    {error && <p className="text-[12.5px] font-medium text-rose-600">{error}</p>}
  </div>
);

const FORMAT_BUTTONS: { action: FormatAction; label: string; icon: typeof Bold; hint?: string }[] =
  [
    { action: 'bold', label: 'Negrito', icon: Bold, hint: 'Ctrl+B' },
    { action: 'italic', label: 'Itálico', icon: Italic, hint: 'Ctrl+I' },
    { action: 'bullets', label: 'Lista com pontos', icon: List },
    { action: 'numbers', label: 'Lista numerada', icon: ListOrdered },
  ];

const size = (bytes: number) =>
  bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

/** Assunto, mensagem, quem assina, anexos e "publicar também na app". */
export const BroadcastFields: React.FC<BroadcastFieldsProps> = ({
  draft,
  errors,
  onChange,
  attachments,
  uploading,
  onAddFiles,
  onRemoveFile,
  publishInApp,
  onPublishInApp,
  sendEmail,
  onSendEmail,
  signatures,
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  /** Formata o que está selecionado (as marcas ficam no texto e saem formatadas no email e no Feed). */
  const format = (action: FormatAction) => {
    const field = messageRef.current;
    const start = field?.selectionStart ?? draft.message.length;
    const end = field?.selectionEnd ?? draft.message.length;
    const result = applyFormat(draft.message, start, end, action);
    onChange({ message: result.value });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(result.selection[0], result.selection[1]);
    });
  };
  return (
    <div className="space-y-4">
      <Field id="bc-subject" label="Assunto" error={errors.subject}>
        <Input
          id="bc-subject"
          value={draft.subject}
          onChange={event => onChange({ subject: event.target.value })}
          placeholder="Ex.: Fecho do escritório na sexta-feira"
          maxLength={200}
          className="h-10"
        />
      </Field>
      <Field id="bc-message" label="Mensagem" error={errors.message}>
        <div
          role="toolbar"
          aria-label="Formatação da mensagem"
          aria-controls="bc-message"
          className="flex flex-wrap items-center gap-1"
        >
          {FORMAT_BUTTONS.map(({ action, label, icon: Icon, hint }) => (
            <button
              key={action}
              type="button"
              onMouseDown={event => event.preventDefault() /* não tira a seleção do texto */}
              onClick={() => format(action)}
              aria-label={label}
              title={hint ? `${label} (${hint})` : label}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rz-primary/40"
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
        <Textarea
          id="bc-message"
          ref={messageRef}
          value={draft.message}
          onChange={event => onChange({ message: event.target.value })}
          onKeyDown={event => {
            if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
            const key = event.key.toLowerCase();
            if (key !== 'b' && key !== 'i') return;
            event.preventDefault();
            format(key === 'b' ? 'bold' : 'italic');
          }}
          placeholder="Escreva aqui. Selecione texto e use os botões acima para negrito, itálico e listas. Uma linha em branco começa um parágrafo novo; endereços (https://…) ficam ligações."
          className="min-h-[220px] text-[14px] leading-relaxed"
        />
        <p className="text-[12px] text-rz-muted">
          No email e na app, **assim** fica a negrito, _assim_ em itálico e as linhas com «- » ou
          «1. » ficam em lista.
        </p>
        {/* Emoji e IA por baixo da caixa (dentro dela tapavam o texto ao deslizar). */}
        <div className="flex flex-wrap items-start gap-1.5">
          <EmojiPicker
            triggerClassName="mt-2 flex h-8 w-8 items-center justify-center rounded-full text-rz-muted ring-1 ring-rz-line hover:bg-rz-canvas hover:text-rz-primary"
            onPick={picked =>
              onChange({ message: insertAtCursor(messageRef.current, draft.message, picked) })
            }
          />
          <BroadcastAi draft={draft} onChange={onChange} />
        </div>
      </Field>
      <Field id="bc-sender" label="Nome do remetente" error={errors.senderName}>
        <Input
          id="bc-sender"
          value={draft.senderName}
          onChange={event => onChange({ senderName: event.target.value })}
          maxLength={120}
          className="h-10"
        />
        <p className="mt-1 text-[12px] text-rz-muted">
          É o nome que aparece no "De:" da caixa de entrada de quem recebe.
        </p>
        <BroadcastSignaturePicker
          signatures={signatures}
          value={draft.signatureId ?? null}
          onChange={signatureId => onChange({ signatureId })}
        />
      </Field>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-semibold ring-1 ring-rz-line hover:bg-rz-primary-soft disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4 text-rz-primary" />
            )}
            Anexar ficheiros
          </button>
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={event => {
              onAddFiles(event.target.files);
              event.target.value = '';
            }}
          />
          {attachments.map(file => (
            <span
              key={file.path}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-rz-canvas py-1 pl-3 pr-1 text-[12.5px]"
            >
              <span className="truncate">{file.name}</span>
              <span className="text-rz-muted">{size(file.size)}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(file.path)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-rz-muted hover:bg-white hover:text-rose-600"
                aria-label={`Tirar ${file.name}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-rz-canvas px-4 py-3">
        <Mail className="h-5 w-5 shrink-0 text-rz-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Enviar por email</span>
          <span className="block text-[12.5px] text-rz-muted">
            Desligado: o comunicado fica só na app, sem email.
          </span>
        </span>
        <Switch checked={sendEmail} onCheckedChange={onSendEmail} />
      </label>
      <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-rz-canvas px-4 py-3">
        <Smartphone className="h-5 w-5 shrink-0 text-rz-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">
            {sendEmail ? 'Publicar também na app' : 'Publicar na app'}
          </span>
          <span className="block text-[12.5px] text-rz-muted">
            Fica no Feed → Comunicados e chega notificação ao telemóvel. Quem não tem email só o vê
            aqui.
          </span>
        </span>
        <Switch checked={publishInApp} onCheckedChange={onPublishInApp} />
      </label>
    </div>
  );
};
