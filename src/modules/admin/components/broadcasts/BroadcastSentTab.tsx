import React, { useState } from 'react';
import type { BroadcastEmployee } from '../../lib/broadcast';
import type { BroadcastHistoryRow } from '../../services/broadcastService';
import { BroadcastDetailSheet } from './BroadcastDetailSheet';
import { BroadcastHistory } from './BroadcastHistory';

interface BroadcastSentTabProps {
  rows: BroadcastHistoryRow[];
  isLoading: boolean;
  people: BroadcastEmployee[];
  canRemind: boolean;
}

/** Comunicados → Enviados: a lista e, ao abrir um, as entregas e as confirmações de leitura. */
export const BroadcastSentTab: React.FC<BroadcastSentTabProps> = ({
  rows,
  isLoading,
  people,
  canRemind,
}) => {
  const [open, setOpen] = useState<BroadcastHistoryRow | null>(null);
  return (
    <>
      <BroadcastHistory rows={rows} isLoading={isLoading} onOpen={setOpen} />
      <BroadcastDetailSheet
        row={open}
        people={people}
        canRemind={canRemind}
        onClose={() => setOpen(null)}
      />
    </>
  );
};
