// Dados da ficha do colaborador que o ecrã envia ao guardar. A empresa só se escolhe ao criar:
// numa ficha existente muda-se com "Mover para empresa…" (rz_transfer_employee), que valida e audita.

export interface EmployeeFormValues {
  name: string;
  phone?: string | null;
  position?: string | null;
  department?: string | null;
  company_id: string;
  nationality?: string | null;
  document_number?: string | null;
  iban?: string | null;
  cartao_da?: string | null;
  cartao_refeicao?: string | null;
  safety_checkup_date?: string | null;
  safety_checkup_renewal_months?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  notes?: string | null;
}

export type EmployeeFormMode = 'create' | 'edit';

/**
 * Os campos a gravar. Em edição `company_id` nunca vai: um UPDATE direto contornava as validações
 * e a auditoria da mudança de empresa. Ao criar, vai.
 */
export const buildEmployeeDetails = (
  data: EmployeeFormValues & {
    safety_checkup_date_iso?: string | null;
    birth_date_iso?: string | null;
  },
  mode: EmployeeFormMode
) => {
  const details = {
    name: data.name,
    phone: data.phone || null,
    position: data.position || null,
    department: data.department?.trim() || null,
    nationality: data.nationality || null,
    document_number: data.document_number || null,
    iban: data.iban || null,
    cartao_da: data.cartao_da || null,
    cartao_refeicao: data.cartao_refeicao || null,
    safety_checkup_date: data.safety_checkup_date_iso ?? null,
    safety_checkup_renewal_months: data.safety_checkup_renewal_months
      ? parseInt(data.safety_checkup_renewal_months)
      : null,
    birth_date: data.birth_date_iso ?? null,
    hire_date: data.hire_date || null,
    notes: data.notes?.trim() || null,
  };
  return mode === 'create' ? { ...details, company_id: data.company_id } : details;
};
