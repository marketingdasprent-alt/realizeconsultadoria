import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Drift } from '../../lib/equipmentDrift';
import { equipmentDriftService } from '../../services/equipmentDriftService';

const BUTTON =
  'inline-flex h-7 items-center rounded-full bg-white px-3 text-[12px] font-semibold ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50';

/**
 * Equipamentos em que a ficha e as entregas não batem certo, com a correção de cada um.
 * Daqui para a frente só as Entregas mudam com quem está o equipamento.
 */
export const EquipmentDriftNotice: React.FC<{ canManage: boolean }> = ({ canManage }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { data: drift = [] } = useQuery({
    queryKey: ['admin', 'equipment-drift'],
    queryFn: async () => {
      const { data, error } = await equipmentDriftService.list();
      if (error) throw error;
      return data ?? [];
    },
  });
  if (drift.length === 0) return null;

  const run = async (item: Drift, action: () => Promise<boolean>, done: string) => {
    setBusy(item.equipment.id);
    const ok = await action();
    setBusy(null);
    toast(ok ? { title: done } : { title: 'Não foi possível corrigir', variant: 'destructive' });
    for (const key of [['admin', 'equipment-drift'], ['equipments'], ['assignments']])
      void queryClient.invalidateQueries({ queryKey: key });
  };

  return (
    <div className="rounded-2xl bg-amber-50 ring-1 ring-amber-200">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13.5px] font-semibold text-amber-900"
      >
        <AlertTriangle className="h-4 w-4" />
        {drift.length} {drift.length === 1 ? 'equipamento' : 'equipamentos'} com a ficha diferente
        das entregas
        <ChevronDown
          className={`ml-auto h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <ul className="space-y-1.5 px-4 pb-3">
          {drift.map(item => (
            <li
              key={item.equipment.id}
              className="flex flex-wrap items-center gap-2 text-[13px] text-amber-950"
            >
              <span className="min-w-0 flex-1">
                <strong>{item.equipment.label}</strong> —{' '}
                {item.kind === 'mismatch'
                  ? `ficha: ${item.equipment.holderName ?? 'ninguém'}; entrega: ${item.delivery.employeeName ?? '—'}`
                  : `com ${item.equipment.holderName} sem entrega registada`}
              </span>
              {busy === item.equipment.id && <Loader2 className="h-4 w-4 animate-spin" />}
              {canManage && item.kind === 'mismatch' && (
                <button
                  type="button"
                  className={BUTTON}
                  disabled={!!busy}
                  onClick={() =>
                    void run(
                      item,
                      () =>
                        equipmentDriftService.followDelivery(
                          item.equipment.id,
                          item.delivery.employee_id
                        ),
                      'Ficha corrigida pela entrega'
                    )
                  }
                >
                  Seguir a entrega
                </button>
              )}
              {canManage && item.kind === 'no_delivery' && (
                <>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        item,
                        () => equipmentDriftService.createDelivery(item.equipment),
                        'Entrega registada'
                      )
                    }
                  >
                    Registar entrega
                  </button>
                  <button
                    type="button"
                    className={BUTTON}
                    disabled={!!busy}
                    onClick={() =>
                      void run(
                        item,
                        () => equipmentDriftService.markAvailable(item.equipment.id),
                        'Marcado como disponível'
                      )
                    }
                  >
                    Está disponível
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
