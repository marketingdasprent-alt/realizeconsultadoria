import React, { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, SendHorizontal } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { filesFromPaste } from '@/modules/workspace/hooks/useFileDrop';
import { ACCEPT_ATTRIBUTE } from '../lib/files';
import type { ChatMessage, SendInput } from '../types';
import { ComposerBanner } from './composer/ComposerBanner';
import { RecordingBar } from './composer/RecordingBar';
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
}

const TOOL =
  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-rz-muted transition-colors hover:bg-rz-canvas hover:text-rz-primary disabled:opacity-40';

/** Caixa de escrita: texto, emojis, anexos e voz (Enter envia, Shift+Enter muda de linha). */
export const MessageComposer: React.FC<MessageComposerProps> = props => {
  const { onSend, onEdit, onTyping, replyTo, editing, onCancel, disabled = false } = props;
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const recorder = useAudioRecorder();
  const canSend = !disabled && text.trim().length > 0;

  // Ao editar, a caixa traz o texto original; ao responder, ganha o foco.
  useEffect(() => {
    if (editing) setText(editing.text ?? '');
    if (editing || replyTo) areaRef.current?.focus();
  }, [editing, replyTo]);

  const submit = () => {
    if (!canSend) return;
    if (editing) onEdit(editing, text.trim());
    else onSend({ text: text.trim(), replyToId: replyTo?.id });
    setText('');
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    onSend({ file, text: text.trim() || undefined, replyToId: replyTo?.id });
    setText('');
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
          'rounded-[24px] bg-white p-1.5 shadow-rz-soft ring-1 ring-rz-line transition-shadow focus-within:ring-rz-primary/40',
          disabled && 'opacity-70'
        )}
      >
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
                aria-label="Anexar ficheiro"
              >
                <Paperclip className="h-5 w-5" />
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={ACCEPT_ATTRIBUTE}
                className="hidden"
                onChange={event => {
                  pickFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <textarea
                ref={areaRef}
                value={text}
                onChange={event => {
                  setText(event.target.value);
                  onTyping();
                }}
                onPaste={event => {
                  // Ctrl+V de uma captura de ecrã ou de ficheiros copiados: envia-os.
                  const files = filesFromPaste(event);
                  if (!files.length || disabled || editing) return;
                  event.preventDefault();
                  files.forEach(pickFile);
                }}
                onKeyDown={event => {
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
