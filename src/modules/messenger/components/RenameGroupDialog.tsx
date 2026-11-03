import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Trash2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import type { ConversationSummary } from '../types';
import { ConversationAvatar } from './ConversationAvatar';

interface RenameGroupDialogProps {
  /** Grupo a editar; null fecha a janela. */
  group: ConversationSummary | null;
  onClose: () => void;
  onSave: (title: string) => void;
  /** Nova foto (ou null para tirar); grava logo. */
  onPhoto: (file: File | null) => Promise<void>;
  /** Quem está no grupo (pôr e tirar pessoas), por baixo do nome. */
  members?: React.ReactNode;
}

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Editar um grupo: foto, nome e pessoas (qualquer membro; tirar pessoas, só o dono). */
export const RenameGroupDialog: React.FC<RenameGroupDialogProps> = ({
  group,
  onClose,
  onSave,
  onPhoto,
  members,
}) => {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setTitle(group?.title ?? ''), [group?.title]);
  const valid = title.trim().length > 0 && title.trim() !== group?.title;

  const changePhoto = async (file: File | null) => {
    if (file && !PHOTO_TYPES.includes(file.type)) {
      toast({ title: 'Escolha uma imagem (JPG, PNG, WebP ou GIF).', variant: 'destructive' });
      return;
    }
    setBusy(true);
    await onPhoto(file);
    setBusy(false);
  };

  return (
    <Dialog open={group !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-[28px] p-6 sm:max-w-3xl sm:rounded-[28px]">
        <DialogTitle className="flex items-center gap-2 text-[18px] font-extrabold">
          <Users className="h-5 w-5 text-rz-primary" /> Editar grupo
        </DialogTitle>
        <div className="grid gap-6 md:grid-cols-[250px_minmax(0,1fr)]">
          <div className="space-y-5">
            {group && (
              <div className="flex flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  disabled={busy}
                  className="relative shrink-0"
                  aria-label="Mudar a foto do grupo"
                >
                  <ConversationAvatar conversation={group} size="lg" />
                  <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-rz-primary text-white shadow-rz-soft ring-2 ring-white">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                  </span>
                </button>
                <div className="min-w-0 space-y-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    disabled={busy}
                    className="block text-[13.5px] font-bold text-rz-primary hover:underline"
                  >
                    {group.avatarUrl ? 'Mudar a foto' : 'Pôr uma foto'}
                  </button>
                  {group.avatarUrl && (
                    <button
                      type="button"
                      onClick={() => void changePhoto(null)}
                      disabled={busy}
                      className="flex items-center gap-1 text-[12.5px] font-semibold text-rz-muted hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Tirar a foto
                    </button>
                  )}
                </div>
                <input
                  ref={input}
                  type="file"
                  accept={PHOTO_TYPES.join(',')}
                  className="hidden"
                  onChange={event => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (file) void changePhoto(file);
                  }}
                />
              </div>
            )}
            <form
              onSubmit={event => {
                event.preventDefault();
                if (!valid) return;
                onSave(title.trim());
                onClose();
              }}
              className="space-y-4"
            >
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold">Nome do grupo</span>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value.slice(0, 80))}
                  aria-label="Nome do grupo"
                  className="h-12 w-full rounded-xl bg-white px-4 text-[15px] font-semibold outline-none ring-2 ring-rz-primary/30 focus:ring-rz-primary"
                />
              </label>
              <button
                type="submit"
                disabled={!valid}
                className="h-10 w-full rounded-full bg-rz-primary px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                Guardar nome
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-full rounded-full text-sm font-semibold text-rz-muted hover:bg-rz-canvas"
              >
                Fechar
              </button>
            </form>
          </div>
          <div className="min-w-0 border-t border-rz-line pt-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            {members}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
