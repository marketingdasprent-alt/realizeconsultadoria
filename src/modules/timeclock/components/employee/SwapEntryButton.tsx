import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ENTRY_TYPE_LABELS, SWAP_WINDOW_MS, type EntryType } from '@/lib/timeclock';

interface SwapEntryButtonProps {
  entryId: string;
  entryType: EntryType;
  onSwap: () => Promise<string | null>;
}

/** "Enganou-se?" — troca Entrada↔Saída nos primeiros minutos após o registo. */
export const SwapEntryButton: React.FC<SwapEntryButtonProps> = ({ entryId, entryType, onSwap }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsVisible(true);
    setError(null);
    const timer = setTimeout(() => setIsVisible(false), SWAP_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [entryId]);

  if (!isVisible) return null;

  const other: EntryType = entryType === 'in' ? 'out' : 'in';

  const handleSwap = async () => {
    setIsBusy(true);
    setError(null);
    const message = await onSwap();
    setIsBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="mt-2">
      <Button variant="outline" size="sm" className="h-8" disabled={isBusy} onClick={handleSwap}>
        {isBusy ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <ArrowLeftRight className="h-4 w-4 mr-1" />
        )}
        Enganou-se? Mudar para {ENTRY_TYPE_LABELS[other]}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
};
