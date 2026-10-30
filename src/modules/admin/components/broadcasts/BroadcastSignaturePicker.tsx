import React from 'react';
import { RzSelect } from '@/modules/workspace/components/RzSelect';
import type { BroadcastSignature } from '../../services/broadcastService';

interface BroadcastSignaturePickerProps {
  signatures: BroadcastSignature[];
  /** null = só o nome. */
  value: string | null;
  onChange: (signatureId: string | null) => void;
}

const NONE = 'none';

/** Assinar o comunicado com a assinatura de email de quem envia (as do Webmail). */
export const BroadcastSignaturePicker: React.FC<BroadcastSignaturePickerProps> = ({
  signatures,
  value,
  onChange,
}) => {
  if (!signatures.length)
    return (
      <p className="mt-1.5 text-[12px] text-rz-muted">
        Sem assinatura de email: vai só este nome. Crie uma no Email → Assinaturas.
      </p>
    );
  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-[12.5px] font-semibold text-rz-muted">Assinatura</span>
      <RzSelect
        value={value ?? NONE}
        onChange={next => onChange(next === NONE ? null : next)}
        ariaLabel="Assinatura do comunicado"
        className="h-9 min-w-[12rem] rounded-full bg-rz-canvas px-3 text-[13px] font-semibold ring-1 ring-rz-line"
        options={[
          ...signatures.map(sig => ({
            value: sig.id,
            label: sig.is_default ? `${sig.name} (predefinida)` : sig.name,
          })),
          { value: NONE, label: 'Só o nome acima' },
        ]}
      />
    </div>
  );
};
