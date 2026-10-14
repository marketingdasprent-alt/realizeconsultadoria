import React, { useEffect, useState } from 'react';
import { Loader2, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UNDO_WINDOW_MS } from '@/lib/workday';

interface WorkdayUndoButtonProps {
  /** Devolve a mensagem de erro, ou null se desfez. */
  onUndo: () => Promise<string | null>;
}

/** "Desfazer" durante 3 minutos: carregou no botão errado e corrige logo. */
export const WorkdayUndoButton: React.FC<WorkdayUndoButtonProps> = ({ onUndo }) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(false), UNDO_WINDOW_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const handleUndo = async () => {
    setIsBusy(true);
    setError(null);
    const message = await onUndo();
    setIsBusy(false);
    if (message) setError(message);
  };

  return (
    <div className="mt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2"
        disabled={isBusy}
        onClick={handleUndo}
      >
        {isBusy ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <Undo2 className="mr-1 h-4 w-4" />
        )}
        Desfazer
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
