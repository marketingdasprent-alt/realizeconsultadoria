import React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompanySaveBarProps {
  /** Id do <form> a guardar. */
  formId: string;
  /** Empresa nova: o botão cria em vez de guardar. */
  isNew: boolean;
  /** A secção atual é a dos dados: a barra aparece mesmo sem alterações. */
  onDataSection: boolean;
  dirty: boolean;
  saving: boolean;
  onDiscard: () => void;
}

/**
 * Barra fixa em baixo: deixa guardar ou descartar sem andar à procura do botão e avisa quando há
 * alterações por guardar. Fica à vista na secção dos dados e, noutra secção, só com alterações.
 */
export const CompanySaveBar: React.FC<CompanySaveBarProps> = ({
  formId,
  isNew,
  onDataSection,
  dirty,
  saving,
  onDiscard,
}) => {
  if (!isNew && !onDataSection && !dirty) return null;
  return (
    <div
      role="group"
      aria-label="Ações da ficha"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-rz-canvas/95 px-4 py-3 backdrop-blur sm:left-auto sm:right-6 sm:bottom-6 sm:w-auto sm:rounded-2xl sm:border sm:shadow-rz-pop"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex flex-wrap items-center justify-end gap-3">
        {!isNew && dirty && (
          <span role="status" className="text-sm font-medium">
            Tem alterações por guardar.
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onDiscard}
          disabled={saving || (!isNew && !dirty)}
        >
          {isNew ? 'Cancelar' : 'Descartar'}
        </Button>
        <Button type="submit" form={formId} variant="gold" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {saving ? 'A guardar…' : isNew ? 'Criar empresa' : 'Guardar alterações'}
        </Button>
      </div>
    </div>
  );
};
