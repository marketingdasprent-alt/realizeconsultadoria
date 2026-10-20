import { supabase } from '@/integrations/supabase/client';
import {
  findDrift,
  type ActiveDelivery,
  type Drift,
  type DriftEquipment,
} from '../lib/equipmentDrift';

interface EquipmentRow {
  id: string;
  brand: string;
  model: string | null;
  equipment_number: number | null;
  company_id: string;
  employee_id: string | null;
  employees: { name: string } | null;
  equipment_categories: { name: string } | null;
}

interface ItemRow {
  equipment_id: string;
  assignments: { employee_id: string; employees: { name: string } | null };
}

const labelOf = (row: EquipmentRow) =>
  [
    row.equipment_categories?.name,
    row.equipment_number ? `#${row.equipment_number}` : null,
    [row.brand, row.model].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

export const equipmentDriftService = {
  /** Equipamentos com a ficha diferente das entregas ativas. */
  list: async (): Promise<{ data: Drift[] | null; error: unknown }> => {
    const [equipments, items] = await Promise.all([
      supabase
        .from('equipments')
        .select(
          'id, brand, model, equipment_number, company_id, employee_id, employees(name), equipment_categories(name)'
        ),
      supabase
        .from('assignment_items')
        .select('equipment_id, assignments!inner(employee_id, status, employees(name))')
        .eq('assignments.status', 'active'),
    ]);
    const error = equipments.error ?? items.error;
    if (error) return { data: null, error };
    const list: DriftEquipment[] = ((equipments.data ?? []) as unknown as EquipmentRow[]).map(
      row => ({
        id: row.id,
        label: labelOf(row),
        company_id: row.company_id,
        employee_id: row.employee_id,
        holderName: row.employees?.name ?? null,
      })
    );
    const deliveries: ActiveDelivery[] = ((items.data ?? []) as unknown as ItemRow[]).map(row => ({
      equipment_id: row.equipment_id,
      employee_id: row.assignments.employee_id,
      employeeName: row.assignments.employees?.name ?? null,
    }));
    return { data: findDrift(list, deliveries), error: null };
  },

  /** A ficha passa a dizer o que diz a entrega. */
  followDelivery: async (equipmentId: string, employeeId: string) => {
    const { error } = await supabase
      .from('equipments')
      .update({ employee_id: employeeId, status: 'assigned' })
      .eq('id', equipmentId);
    return !error;
  },

  /** Regista a entrega que faltava (depois imprime-se a declaração em Entregas). */
  createDelivery: async (equipment: DriftEquipment) => {
    if (!equipment.employee_id) return false;
    const { data, error } = await supabase
      .from('assignments')
      .insert({
        employee_id: equipment.employee_id,
        company_id: equipment.company_id,
        status: 'active',
      })
      .select('id')
      .single();
    if (error || !data) return false;
    const { error: itemError } = await supabase
      .from('assignment_items')
      .insert({ assignment_id: data.id, equipment_id: equipment.id });
    return !itemError;
  },

  /** Não está com ninguém: fica disponível. */
  markAvailable: async (equipmentId: string) => {
    const { error } = await supabase
      .from('equipments')
      .update({ employee_id: null, status: 'available' })
      .eq('id', equipmentId);
    return !error;
  },
};
