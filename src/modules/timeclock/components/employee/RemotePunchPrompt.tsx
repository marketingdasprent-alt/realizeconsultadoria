import React, { useState } from 'react';
import { House, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatDistance } from '@/lib/timeclock';

interface RemotePunchPromptProps {
  distanceM?: number | null;
  locationName?: string | null;
  isBusy: boolean;
  onConfirm: (note: string) => void;
}

/**
 * Fora do local de trabalho: o colaborador confirma que está em trabalho
 * remoto (casa, cliente, deslocação) e o registo fica a aguardar aprovação.
 */
export const RemotePunchPrompt: React.FC<RemotePunchPromptProps> = ({
  distanceM,
  locationName,
  isBusy,
  onConfirm,
}) => {
  const [note, setNote] = useState('');

  return (
    <div className="space-y-3 rounded-lg border border-sky-300 bg-sky-50 p-4 dark:bg-sky-900/20">
      {typeof distanceM === 'number' && locationName && (
        <p className="text-sm">
          Está a <strong>{formatDistance(distanceM)}</strong> de {locationName}.
        </p>
      )}
      <p className="text-sm">
        Está a trabalhar fora (em casa, num cliente, em deslocação)? Pode registar como{' '}
        <strong>trabalho remoto</strong>. O registo fica a aguardar aprovação dos RH.
      </p>
      <Textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        maxLength={300}
        rows={2}
        placeholder="Motivo (opcional) — ex.: teletrabalho, reunião no cliente…"
      />
      <Button variant="gold" className="w-full" disabled={isBusy} onClick={() => onConfirm(note)}>
        {isBusy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <House className="h-4 w-4 mr-2" />
        )}
        Registar como trabalho remoto
      </Button>
    </div>
  );
};
