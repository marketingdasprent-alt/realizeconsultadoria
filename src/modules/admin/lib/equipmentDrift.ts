// Acessos → Equipamentos: equipamentos cuja ficha ("com quem está") não bate com as entregas.
// A entrega (com a declaração assinada) é que manda; antes dava para mudar a pessoa na ficha.

export interface DriftEquipment {
  id: string;
  label: string;
  company_id: string;
  employee_id: string | null;
  holderName: string | null;
}

export interface ActiveDelivery {
  equipment_id: string;
  employee_id: string;
  employeeName: string | null;
}

export type Drift =
  /** Está numa entrega ativa de outra pessoa (ou sem ninguém na ficha). */
  | { kind: 'mismatch'; equipment: DriftEquipment; delivery: ActiveDelivery }
  /** A ficha diz que está com alguém, mas não há entrega ativa. */
  | { kind: 'no_delivery'; equipment: DriftEquipment };

export const findDrift = (equipments: DriftEquipment[], deliveries: ActiveDelivery[]): Drift[] => {
  const byEquipment = new Map(deliveries.map(d => [d.equipment_id, d]));
  const drift: Drift[] = [];
  for (const equipment of equipments) {
    const delivery = byEquipment.get(equipment.id);
    if (delivery && delivery.employee_id !== equipment.employee_id)
      drift.push({ kind: 'mismatch', equipment, delivery });
    else if (!delivery && equipment.employee_id) drift.push({ kind: 'no_delivery', equipment });
  }
  return drift.sort((a, b) => a.equipment.label.localeCompare(b.equipment.label));
};
