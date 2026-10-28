import React, { useRef } from 'react';
import { Loader2, Paperclip, Smartphone, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { insertAtCursor } from '@/lib/insertAtCursor';
import { EmojiPicker } from '@/modules/messenger/components/EmojiPicker';
import type { BroadcastDraft, BroadcastErrors } from '../../lib/broadcast';
import type { BroadcastAttachment } from '../../services/broadcastService';

interface BroadcastFieldsProps {
  draft: BroadcastDraft;
  errors: BroadcastErrors;
  onChange: (patch: Partial<BroadcastDraft>) => void;
  attachments: BroadcastAttachment[];
  uploading: boolean;
  onAddFiles: (files: FileList | null) => void;
  onRemoveFile: (path: string) => void;
  publishInApp: boolean;
  onPublishInApp: (value: boolean) => void;
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
}) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
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
        <div className="relative">
          <Textarea
            id="bc-message"
            ref={messageRef}
            value={draft.message}
            onChange={event => onChange({ message: event.target.value })}
            placeholder="Escreva aqui. Uma linha em branco começa um parágrafo novo; endereços (https://…) ficam ligações."
            className="min-h-[220px] pb-11 text-[14px] leading-relaxed"
          />
          <EmojiPicker
            triggerClassName="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full text-rz-muted hover:bg-rz-canvas hover:text-rz-primary"
            onPick={picked =>
              onChange({ message: insertAtCursor(messageRef.current, draft.message, picked) })
            }
          />
        </div>
      </Field>
      <Field id="bc-sender" label="Quem assina" error={errors.senderName}>
        <Input
          id="bc-sender"
          value={draft.senderName}
          onChange={event => onChange({ senderName: event.target.value })}
          maxLength={120}
          className="h-10"
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
        <Smartphone className="h-5 w-5 shrink-0 text-rz-primary" />
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold">Publicar também na app</span>
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
