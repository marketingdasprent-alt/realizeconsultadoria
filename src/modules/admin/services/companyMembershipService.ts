// Mover colaboradores entre empresas e gerir administradores: as chamadas `rz_*` da Fase C1
// (docs/multiempresa/FASE-C1.md). Os erros da base chegam como RAISE EXCEPTION 'codigo' com o
// texto em português em `details`; aqui viram SharingError (código + texto) e o ecrã mostra o texto.
import { supabase } from '@/integrations/supabase/client';
import { SharingError, toSharingError } from '../lib/sharing';
import {
  parseAdminChange,
  parseBulkResult,
  parseTransferResult,
  type AdminChange,
  type AdminRole,
  type BulkTransferResult,
  type CandidateSource,
  type CompanyEmployee,
  type TransferResult,
} from '../lib/companyMembership';

interface RpcResult {
  data: unknown;
  error: { message?: string; details?: string | null; code?: string } | null;
}

const unwrap = ({ data, error }: RpcResult): unknown => {
  if (error) throw toSharingError(error);
  return data;
};

interface LooseTable {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        eq: (
          column: string,
          value: string
        ) => {
          order: (column: string) => {
            order: (column: string) => {
              range: (from: number, to: number) => PromiseLike<RpcResult>;
            };
          };
        };
      };
    };
  };
}

const MEMBERSHIP_PAGE = 1000;

export const companyMembershipService = {
  /**
   * Pertenças de administrador ativas que a conta pode ler (o super admin lê todas; um admin de
   * empresa só as das suas empresas): uma só consulta para a lista de Empresas.
   */
  adminMemberships: async (): Promise<{ company_id: string; user_id: string }[]> => {
    const rows: { company_id: string; user_id: string }[] = [];
    // O PostgREST devolve no máximo ~1000 linhas por pedido: lê por páginas, em ordem estável,
    // para a contagem de administradores nunca ficar curta sem aviso.
    for (let from = 0; ; from += MEMBERSHIP_PAGE) {
      const { data, error } = await (supabase as unknown as LooseTable)
        .from('company_memberships')
        .select('company_id, user_id')
        .eq('role', 'admin')
        .eq('status', 'ativo')
        .order('company_id')
        .order('user_id')
        .range(from, from + MEMBERSHIP_PAGE - 1);
      if (error) throw toSharingError(error);
      const page = (data ?? []) as { company_id: string; user_id: string }[];
      rows.push(...page);
      if (page.length < MEMBERSHIP_PAGE) return rows;
    }
  },

  /** Move um colaborador para outra empresa (atómica; devolve o que fica por tratar). */
  transferEmployee: async (
    employeeId: string,
    toCompany: string,
    note: string | null = null
  ): Promise<TransferResult> =>
    parseTransferResult(
      unwrap(
        await supabase.rpc('rz_transfer_employee', {
          p_employee: employeeId,
          p_to_company: toCompany,
          p_note: note,
        })
      )
    ),

  /** Move várias fichas (até 200): uma má não aborta as outras; vem um item por ficha. */
  transferEmployees: async (
    employeeIds: string[],
    toCompany: string
  ): Promise<BulkTransferResult> =>
    parseBulkResult(
      unwrap(
        await supabase.rpc('rz_transfer_employees', {
          p_employees: employeeIds,
          p_to_company: toCompany,
        })
      )
    ),

  /** Junta (ou promove) um administrador ou gestor da empresa. */
  addAdmin: async (company: string, user: string, role: AdminRole): Promise<AdminChange> =>
    parseAdminChange(
      unwrap(
        await supabase.rpc('rz_add_company_admin', {
          p_company: company,
          p_user: user,
          p_role: role,
        })
      )
    ),

  /** Retira um administrador ou gestor (a base recusa o último administrador). */
  removeAdmin: async (company: string, user: string): Promise<AdminChange> =>
    parseAdminChange(
      unwrap(
        await supabase.rpc('rz_remove_company_admin', {
          p_company: company,
          p_user: user,
        })
      )
    ),

  /** Colaboradores ativos da empresa com conta de utilizador (candidatos a administrador). */
  companyEmployeesWithAccount: async (company: string): Promise<CandidateSource[]> => {
    const { data, error } = await supabase
      .from('employees')
      .select('name, email, user_id, is_active')
      .eq('company_id', company)
      .eq('is_active', true)
      .not('user_id', 'is', null)
      .order('name');
    if (error) throw new SharingError('unknown');
    return data ?? [];
  },

  /** Colaboradores ativos da empresa (com ou sem conta), por nome. */
  companyEmployees: async (company: string): Promise<CompanyEmployee[]> => {
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, email, company_id, user_id, is_active, position, department')
      .eq('company_id', company)
      .eq('is_active', true)
      .order('name');
    if (error) throw new SharingError('unknown');
    return data ?? [];
  },

  /** Fichas ativas das outras empresas (candidatas a passar para esta); a base filtra pela RLS. */
  employeesOutsideCompany: async (company: string): Promise<CompanyEmployee[]> => {
    const { data, error } = await supabase
      .from('employees')
      .select(
        'id, name, email, company_id, user_id, is_active, position, department, companies(name)'
      )
      .neq('company_id', company)
      .eq('is_active', true)
      .order('name')
      .limit(1000);
    if (error) throw new SharingError('unknown');
    return (data ?? []).map(({ companies, ...employee }) => ({
      ...employee,
      companyName: companies?.name ?? null,
    }));
  },
};
