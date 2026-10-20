import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Package, Phone } from 'lucide-react';
import AssignmentsTab from '@/components/admin/AssignmentsTab';
import EquipmentsTab from '@/components/admin/EquipmentsTab';
import PhonesTab from '@/components/admin/PhonesTab';
import { cn } from '@/lib/utils';

const VIEWS = [
  { value: 'inventario', label: 'Equipamentos', icon: Package },
  { value: 'sim', label: 'Cartões SIM', icon: Phone },
  { value: 'entregas', label: 'Entregas', icon: ClipboardList },
] as const;

type View = (typeof VIEWS)[number]['value'];

interface EquipmentAreaProps {
  canManage: boolean;
  companies: { id: string; name: string }[];
  companyFilter: string;
  setCompanyFilter: (value: string) => void;
}

/** Acessos → Equipamentos: o material (equipamentos e cartões SIM) e as entregas. */
export const EquipmentArea: React.FC<EquipmentAreaProps> = props => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: View = VIEWS.some(v => v.value === searchParams.get('ver'))
    ? (searchParams.get('ver') as View)
    : 'inventario';

  const change = (next: View) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'inventario') params.delete('ver');
    else params.set('ver', next);
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-4">
      <div
        className="flex w-fit gap-1 rounded-full bg-rz-canvas p-1 ring-1 ring-rz-line"
        role="tablist"
      >
        {VIEWS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={view === value}
            onClick={() => change(value)}
            className={cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
              view === value ? 'bg-white text-rz-ink shadow-sm' : 'text-rz-muted hover:text-rz-ink'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {view === 'inventario' && <EquipmentsTab {...props} />}
      {view === 'sim' && <PhonesTab {...props} />}
      {view === 'entregas' && <AssignmentsTab />}
    </div>
  );
};
