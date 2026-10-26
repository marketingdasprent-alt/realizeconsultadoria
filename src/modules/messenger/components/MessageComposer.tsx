import React, { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, SendHorizontal } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { EmojiSuggestions } from '@/modules/workspace/components/EmojiSuggestions';
import { useEmojiAutocomplete } from '@/modules/workspace/hooks/useEmojiAutocomplete';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { filesFromPaste } from '@/modules/workspace/hooks/useFileDrop';
import { ACCEPT_ATTRIBUTE } from '../lib/files';
import type { ChatMessage, SendInput } from '../types';
import { ComposerBanner } from './composer/ComposerBanner';
import { RecordingBar } from './composer/RecordingBar';
import { StagedFiles } from './composer/StagedFiles';
import { EmojiPicker } from './EmojiPicker';

interface MessageComposerProps {
  onSend: (input: SendInput) => void;
  onEdit: (message: ChatMessage, text: string) => void;
  onTyping: () => void;
  replyTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancel: () => void;
  /** Sem envio (canal só de leitura). */
  disabled?: boolean;
  disabledHint?: string;
  /** Conversa aberta: ao mudar, o cursor vai logo para a caixa de escrita. */
  conversationId?: string;
  /** Anexos à espera de envio (clipe, colar ou largar na conversa). */
  staged: File[];
  onStagedChange: (files: File[]) => void;
}

const MAX_STAGED = 10;

const TOOL =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary disabled:opacity-40';

/** Caixa de escrita: texto, emojis, anexos e voz (Enter envia, Shift+Enter muda de linha). */
export const MessageComposer: React.FC<MessageComposerProps> = props => {
  const { onSend, onEdit, onTyping, replyTo, editing, onCancel, disabled = false } = props;
  const { staged, onStagedChange } = props;
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const recorder = useAudioRecorder();
  // ":so" → lista de emojis, como no WhatsApp.
  const emoji = useEmojiAutocomplete({ value: text, onChange: setText, fieldRef: areaRef });
  const canSend = !disabled && (text.trim().length > 0 || (staged.length > 0 && !editing));

  // Ao abrir uma conversa, escreve-se logo (no telemóvel não, para o teclado não tapar a conversa).
  useEffect(() => {
    if (disabled || window.matchMedia?.('(pointer: coarse)').matches) return;
    areaRef.current?.focus();
  }, [props.conversationId, disabled]);

  // Ao editar, a caixa traz o texto original; ao responder, ganha o foco.
  useEffect(() => {
    if (editing) setText(editing.text ?? '');
    if (editing || replyTo) areaRef.current?.focus();
  }, [editing, replyTo]);

  // Vários ficheiros de uma vez: o texto e a resposta vão com o primeiro (como no WhatsApp).
  const submit = () => {
    if (!canSend) return;
    if (editing) onEdit(editing, text.trim());
    else if (staged.length) {
      staged.forEach((file, index) =>
        onSend(
          index === 0 ? { file, text: text.trim() || undefined, replyToId: replyTo?.id } : { file }
        )
      );
      onStagedChange([]);
    } else onSend({ text: text.trim(), replyToId: replyTo?.id });
    setText('');
  };

  // Os ficheiros ficam na bandeja até Enviar, para se poder escrever a mensagem junto.
  const pickFiles = (files: File[]) => {
    if (!files.length) return;
    const next = [...staged, ...files];
    if (next.length > MAX_STAGED)
      toast({ title: `No máximo ${MAX_STAGED} ficheiros de cada vez.`, variant: 'destructive' });
    onStagedChange(next.slice(0, MAX_STAGED));
    areaRef.current?.focus();
  };

  const startRecording = async () => {
    if (!(await recorder.start())) {
      toast({ title: 'Microfone indisponível', description: 'Autorize o acesso ao microfone.' });
    }
  };

  const sendRecording = async () => {
    const recording = await recorder.stop();
    if (recording) onSend({ audio: recording, replyToId: replyTo?.id });
  };

  return (
    <div className="px-3 pb-3 pt-2 md:px-5 md:pb-5">
      <div
        className={cn(
          'relative rounded-[24px] bg-white p-1.5 shadow-rz-soft ring-1 ring-rz-line transition-shadow focus-within:ring-rz-primary/40',
          disabled && 'opacity-70'
        )}
      >
        <EmojiSuggestions
          suggestions={emoji.suggestions}
          active={emoji.active}
          onPick={emoji.pick}
          onHover={emoji.setActive}
          className="left-2"
        />
        {!editing && (
          <StagedFiles
            files={staged}
            onRemove={index => onStagedChange(staged.filter((_, i) => i !== index))}
          />
        )}
        {(editing || replyTo) && (
          <ComposerBanner
            mode={editing ? 'edit' : 'reply'}
            title={editing ? 'A editar mensagem' : `Responder a ${replyTo?.authorName}`}
            text={(editing ?? replyTo)?.text ?? (editing ?? replyTo)?.attachment?.name ?? 'Anexo'}
            onCancel={() => {
              setText('');
              onCancel();
            }}
          />
        )}
        <div className="flex items-end gap-1">
          {recorder.isRecording ? (
            <RecordingBar
              seconds={recorder.seconds}
              onCancel={recorder.cancel}
              onSend={sendRecording}
            />
          ) : (
            <>
              <EmojiPicker
                triggerClassName={TOOL}
                disabled={disabled}
                onPick={emoji => setText(current => current + emoji)}
              />
              <button
                type="button"
                className={TOOL}
                disabled={disabled || !!editing}
                onClick={() => fileRef.current?.click()}
                aria-label="Anexar ficheiros"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT_ATTRIBUTE}
                className="hidden"
                onChange={event => {
                  pickFiles(Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
              <textarea
                ref={areaRef}
                value={text}
                onChange={event => {
                  setText(event.target.value);
                  emoji.update(event.target.value);
                  onTyping();
                }}
                onSelect={() => emoji.update()}
                onBlur={emoji.close}
                onPaste={event => {
                  // Ctrl+V de uma captura de ecrã ou de ficheiros copiados: vão para a bandeja.
                  const files = filesFromPaste(event);
                  if (!files.length || disabled || editing) return;
                  event.preventDefault();
                  pickFiles(files);
                }}
                onKeyDown={event => {
                  if (emoji.onKeyDown(event)) return;
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                  if (event.key === 'Escape' && (editing || replyTo)) onCancel();
                }}
                rows={Math.min(5, Math.max(1, text.split('\n').length))}
                disabled={disabled}
                placeholder={
                  disabled ? (props.disabledHint ?? 'Envio indisponível') : 'Escreva uma mensagem…'
                }
                className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2.5 text-[14.5px] outline-none placeholder:text-rz-muted"
                aria-label="Mensagem"
              />
              {canSend || editing ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canSend}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rz-primary text-white shadow-[0_8px_18px_-8px_hsl(var(--rz-primary))] transition-transform hover:scale-105 disabled:opacity-50"
                  aria-label={editing ? 'Guardar' : 'Enviar'}
                >
                  <SendHorizontal className="h-[18px] w-[18px]" />
                </button>
              ) : (
                <button
                  type="button"
                  className={TOOL}
                  disabled={disabled || !recorder.isSupported}
                  onClick={startRecording}
                  aria-label="Gravar mensagem de voz"
                >
                  <Mic className="h-5 w-5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
