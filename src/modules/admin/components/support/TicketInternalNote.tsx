import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Lock } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { SUPPORT_KEYS } from '../../hooks/useSupportConversation';
import { supportAdminService } from '../../services/supportAdminService';

/** Nota interna do ticket: só os administradores a veem (o colaborador nunca). */
export const TicketInternalNote: React.FC<{ ticketId: string }> = ({ ticketId }) => {
  const qc = useQueryClient();
  const note = useQuery({
    queryKey: SUPPORT_KEYS.note(ticketId),
    queryFn: async () => {
      const { data, error } = await supportAdminService.getInternalNote(ticketId);
      if (error) throw error;
      return data?.notes ?? '';
    },
  });
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setText(note.data ?? ''), [note.data]);

  const dirty = text !== (note.data ?? '');
  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    const { error } = await supportAdminService.saveInternalNote(ticketId, text.trim());
    setSaving(false);
    if (error) return void toast({ title: 'A nota não foi guardada', variant: 'destructive' });
    void qc.invalidateQueries({ queryKey: SUPPORT_KEYS.note(ticketId) });
    toast({ title: 'Nota interna guardada' });
  };

  return (
    <div className="rounded-[22px] bg-amber-50 p-3 ring-1 ring-amber-200">
      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-amber-900">
        <Lock className="h-3.5 w-3.5" /> Nota interna · só a equipa de suporte vê
      </p>
      <textarea
        value={text}
        onChange={event => setText(event.target.value)}
        onBlur={() => void save()}
        rows={2}
        disabled={note.isLoading}
        placeholder="Ex.: falei com o contabilista, aguardar até sexta."
        className="mt-2 w-full resize-y rounded-xl bg-white/70 px-3 py-2 text-[13.5px] outline-none ring-1 ring-amber-200 placeholder:text-amber-900/40 focus:bg-white focus:ring-amber-400"
      />
      {(saving || dirty) && (
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-amber-900/70">
          {saving ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> A guardar…
            </>
          ) : (
            'Guarda ao sair da caixa.'
          )}
        </p>
      )}
    </div>
  );
};
