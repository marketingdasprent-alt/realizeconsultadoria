import { Laptop } from 'lucide-react';

interface Equipment {
  id: string;
  brand?: string | null;
  model?: string | null;
  equipment_number?: string | number | null;
  serial_number?: string | null;
  pass_year?: string | number | null;
}

interface EmployeeEquipmentSectionProps {
  equipments: Equipment[];
}

/** Equipamentos atribuídos ao colaborador (geridos em Acessos → Atribuições). */
export const EmployeeEquipmentSection = ({ equipments }: EmployeeEquipmentSectionProps) => {
  if (equipments.length === 0) {
    return <p className="text-[13px] text-rz-muted">Nenhum equipamento atribuído.</p>;
  }

  return (
    <ul className="space-y-2">
      {equipments.map(equipment => (
        <li key={equipment.id} className="flex items-center gap-3 rounded-2xl bg-rz-canvas p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-rz-muted ring-1 ring-rz-line">
            <Laptop className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] font-semibold">
              {equipment.brand} {equipment.model}
            </p>
            {(equipment.serial_number || equipment.pass_year) && (
              <p className="truncate text-[12px] text-rz-muted">
                {equipment.serial_number && `SN: ${equipment.serial_number}`}
                {equipment.serial_number && equipment.pass_year && ' · '}
                {equipment.pass_year && `Pass: ${equipment.pass_year}`}
              </p>
            )}
          </div>
          {equipment.equipment_number && (
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-rz-muted ring-1 ring-rz-line">
              #{equipment.equipment_number}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
};
