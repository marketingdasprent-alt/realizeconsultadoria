// Leitura dos dados do colaborador para as listas do admin (empresa da relação, aniversário).
import type { Employee } from '../services/employeeService';

type WithCompany = Employee & { companies?: { id?: string; name?: string } | null };

export const companyName = (employee: Employee): string =>
  (employee as WithCompany).companies?.name ?? '';

/** Faz anos no mês indicado (0 = janeiro), pela data AAAA-MM-DD (sem fusos). */
export const hasBirthdayIn = (employee: Employee, month: number): boolean =>
  !!employee.birth_date && Number(employee.birth_date.slice(5, 7)) - 1 === month;

/** Empresas presentes na lista (id + nome), por ordem alfabética. */
export const companiesOf = (employees: Employee[]): { id: string; name: string }[] => {
  const byId = new Map<string, string>();
  for (const employee of employees) byId.set(employee.company_id, companyName(employee));
  return [...byId.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
};
