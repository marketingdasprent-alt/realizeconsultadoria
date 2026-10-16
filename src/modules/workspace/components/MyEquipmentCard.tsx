import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { KeyRound, Laptop, Loader2, Smartphone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '../context/workspaceContext';

interface MyEquipment {
  equipments: {
    id: string;
    category: string | null;
    brand: string | null;
    model: string | null;
    serial: string | null;
    number: string | null;
  }[];
  phones: { id: string; number: string; operator: string | null; label: string | null }[];
  keys: number | null;
}

const DEMO: MyEquipment = {
  equipments: [
    {
      id: 'd1',
      category: 'Portátil',
      brand: 'Lenovo',
      model: 'ThinkPad E14',
      serial: 'PF3X9Z',
      number: 'EQ-012',
    },
  ],
  phones: [{ id: 'p1', number: '912 345 678', operator: 'MEO', label: 'Telemóvel de serviço' }],
  keys: 2,
};

/** Equipamentos, telemóveis e chaves atribuídos ao colaborador (só leitura). */
export const MyEquipmentCard: React.FC = () => {
  const { isPreview, user } = useWorkspace();
  const query = useQuery({
    queryKey: ['my-equipment', user.userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('my_equipment');
      if (error) throw error;
      return data as unknown as MyEquipment;
    },
    enabled: !isPreview,
    staleTime: 5 * 60_000,
  });
  const data = isPreview ? DEMO : query.data;
  const empty = data && !data.equipments.length && !data.phones.length && !data.keys;

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-rz-soft ring-1 ring-rz-line md:p-6">
      <h2 className="mb-3 text-[16px] font-bold">Equipamentos atribuídos</h2>
      {!data ? (
        <Loader2 className="mx-auto my-4 h-5 w-5 animate-spin text-rz-primary" />
      ) : empty ? (
        <p className="text-[13.5px] text-rz-muted">Não tem equipamentos atribuídos.</p>
      ) : (
        <ul className="space-y-2">
          {data.equipments.map(eq => (
            <li key={eq.id} className="flex items-center gap-3 rounded-2xl bg-rz-canvas/70 p-3">
              <Laptop className="h-5 w-5 shrink-0 text-rz-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold">
                  {[eq.brand, eq.model].filter(Boolean).join(' ') || eq.category || 'Equipamento'}
                </span>
                <span className="block truncate text-[12.5px] text-rz-muted">
                  {[eq.category, eq.number && `Nº ${eq.number}`, eq.serial && `S/N ${eq.serial}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </li>
          ))}
          {data.phones.map(phone => (
            <li key={phone.id} className="flex items-center gap-3 rounded-2xl bg-rz-canvas/70 p-3">
              <Smartphone className="h-5 w-5 shrink-0 text-rz-primary" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold">{phone.number}</span>
                <span className="block truncate text-[12.5px] text-rz-muted">
                  {[phone.label, phone.operator].filter(Boolean).join(' · ') || 'Telemóvel'}
                </span>
              </span>
            </li>
          ))}
          {!!data.keys && (
            <li className="flex items-center gap-3 rounded-2xl bg-rz-canvas/70 p-3">
              <KeyRound className="h-5 w-5 shrink-0 text-rz-primary" />
              <span className="text-[14px] font-bold">
                {data.keys} {data.keys === 1 ? 'chave' : 'chaves'}
              </span>
            </li>
          )}
        </ul>
      )}
    </section>
  );
};
