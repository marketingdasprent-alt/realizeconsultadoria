import React, { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CHAT_KEYS } from '@/modules/messenger/lib/cache';
import { useWorkspace } from '../../context/workspaceContext';
import { prepareAvatar } from '../../lib/avatars';
import { profileService } from '../../services/profileService';

/** Câmara sobre o avatar do próprio perfil: escolher, recortar, reduzir e enviar a foto. */
export const AvatarUploadButton: React.FC = () => {
  const { user, isPreview } = useWorkspace();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (isPreview) {
      toast({ title: 'Pré-visualização', description: 'Aqui não se guardam fotografias.' });
      return;
    }
    setBusy(true);
    try {
      const { blob, ext } = await prepareAvatar(file);
      const { error } = await profileService.uploadAvatar(user.userId, blob, ext);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: CHAT_KEYS.directory });
      toast({ title: 'Fotografia atualizada' });
    } catch (error: unknown) {
      toast({
        title: 'A fotografia não foi guardada',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        title="Alterar fotografia"
        className="absolute bottom-1 left-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-rz-ink shadow-rz-soft ring-1 ring-rz-line transition-colors hover:bg-rz-primary-soft"
        aria-label="Alterar fotografia"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={event => void upload(event.target.files?.[0])}
      />
    </>
  );
};
