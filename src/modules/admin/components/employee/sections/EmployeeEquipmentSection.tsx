import { Package } from 'lucide-react';

interface EmployeeEquipmentSectionProps {
  equipments: any[];
}

export const EmployeeEquipmentSection = ({ equipments }: EmployeeEquipmentSectionProps) => {
  if (equipments.length === 0) {
    return (
      <div className="pt-4 border-t">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Package className="h-4 w-4" /> Equipamentos Atribuídos
        </h3>
        <p className="text-sm text-muted-foreground">Nenhum equipamento atribuído.</p>
      </div>
    );
  }

  return (
    <div className="pt-4 border-t">
      <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
        <Package className="h-4 w-4" /> Equipamentos Atribuídos
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {equipments.map(eq => (
          <div
            key={eq.id}
            className="border rounded-md p-3 bg-muted/20 flex flex-col justify-between"
          >
            <div>
              <p className="font-medium text-sm flex items-center justify-between">
                <span>
                  {eq.brand} {eq.model}
                </span>
                {eq.equipment_number && (
                  <span className="text-[10px] font-mono bg-secondary/80 px-1.5 py-0.5 rounded-sm">
                    #{eq.equipment_number}
                  </span>
                )}
              </p>
              {(eq.serial_number || eq.pass_year) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {eq.serial_number && <span>SN: {eq.serial_number}</span>}
                  {eq.serial_number && eq.pass_year && <span className="mx-1">•</span>}
                  {eq.pass_year && <span>Pass: {eq.pass_year}</span>}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
