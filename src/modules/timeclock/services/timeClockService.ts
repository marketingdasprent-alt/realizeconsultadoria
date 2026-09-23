import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { PositionPayload } from '@/lib/geolocation';
import type { TagPayload } from '@/lib/nfc';
import type {
  EntryType,
  PunchMethod,
  TimeClockAttempt,
  TimeClockEntryWithRelations,
  TimeClockHistory,
} from '@/lib/timeclock';

export interface PunchRequest {
  method: PunchMethod;
  tag?: TagPayload;
  position: PositionPayload;
  device_id: string | null;
  entry_type?: EntryType;
}

export interface PunchResponse {
  ok: boolean;
  code: string;
  entry?: {
    id: string;
    entry_type: EntryType;
    punched_at: string;
    status: string;
    flags: string[];
    distance_m: number | null;
    location_name: string;
  };
}

export interface EntryFilters {
  fromIso: string;
  toIso: string;
  companyId?: string | null;
  employeeId?: string | null;
  status?: string | null;
}

export type TimeClockAttemptWithRelations = TimeClockAttempt & {
  employee?: { name: string } | null;
  location?: { name: string } | null;
};

const ENTRY_SELECT =
  '*, employee:employees(id, name, company_id), location:time_clock_locations(name)';

export interface CurrentEmployee {
  id: string;
  name: string;
  company_id: string;
  companies: { name: string } | null;
}

export const timeClockService = {
  /**
   * Colaborador associado à sessão atual (null se não houver sessão/colaborador).
   */
  getCurrentEmployee: async (): Promise<{ data: CurrentEmployee | null; error: unknown }> => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return { data: null, error: null };
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, company_id, companies(name)')
      .eq('user_id', session.user.id)
      .maybeSingle();
    return { data: (data as CurrentEmployee | null) ?? null, error };
  },

  /**
   * Regista o ponto do colaborador autenticado (validação feita no servidor).
   */
  punch: async (body: PunchRequest): Promise<{ data: PunchResponse | null; error: unknown }> => {
    const { data, error } = await supabase.functions.invoke<PunchResponse>('clock-punch', { body });
    if (!error) return { data, error: null };
    // Respostas 4xx trazem { ok: false, code } no corpo.
    if (error instanceof FunctionsHttpError) {
      try {
        const payload = (await error.context.json()) as PunchResponse;
        if (payload?.code) return { data: payload, error: null };
      } catch {
        // corpo não é JSON → devolve o erro original
      }
    }
    return { data: null, error };
  },

  /**
   * Registos do colaborador autenticado num intervalo (RLS limita ao próprio).
   */
  getMyEntries: async (employeeId: string, fromIso: string, toIso: string) => {
    const { data, error } = await supabase
      .from('time_clock_entries')
      .select(ENTRY_SELECT)
      .eq('employee_id', employeeId)
      .gte('punched_at', fromIso)
      .lt('punched_at', toIso)
      .order('punched_at', { ascending: false });
    return { data: (data ?? []) as TimeClockEntryWithRelations[], error };
  },

  /**
   * Folha de ponto (admin) filtrada por período, empresa, colaborador e estado.
   */
  getEntries: async ({ fromIso, toIso, companyId, employeeId, status }: EntryFilters) => {
    let query = supabase
      .from('time_clock_entries')
      .select(ENTRY_SELECT)
      .gte('punched_at', fromIso)
      .lt('punched_at', toIso)
      .order('punched_at', { ascending: true })
      .limit(5000);
    if (companyId) query = query.eq('company_id', companyId);
    if (employeeId) query = query.eq('employee_id', employeeId);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    return { data: (data ?? []) as TimeClockEntryWithRelations[], error };
  },

  /**
   * Tentativas rejeitadas (fora do raio, tag inválida, VPN bloqueada, ...).
   */
  getAttempts: async (fromIso: string, toIso: string) => {
    const { data, error } = await supabase
      .from('time_clock_attempts')
      .select('*, employee:employees(name), location:time_clock_locations(name)')
      .gte('created_at', fromIso)
      .lt('created_at', toIso)
      .order('created_at', { ascending: false })
      .limit(500);
    return { data: (data ?? []) as TimeClockAttemptWithRelations[], error };
  },

  /**
   * Histórico de um registo, ou de todos os registos num período.
   */
  getHistory: async (params: { entryId?: string; fromIso?: string; toIso?: string }) => {
    let query = supabase
      .from('time_clock_entry_history')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(500);
    if (params.entryId) query = query.eq('entry_id', params.entryId);
    if (params.fromIso) query = query.gte('changed_at', params.fromIso);
    if (params.toIso) query = query.lt('changed_at', params.toIso);
    const { data, error } = await query;
    return { data: (data ?? []) as TimeClockHistory[], error };
  },

  /**
   * Cria um registo manual (admin). O motivo fica no histórico.
   */
  createEntry: async (params: {
    employeeId: string;
    entryType: EntryType;
    punchedAtIso: string;
    reason: string;
    notes?: string | null;
  }) => {
    const { data, error } = await supabase.rpc('time_clock_admin_create_entry', {
      _employee_id: params.employeeId,
      _entry_type: params.entryType,
      _punched_at: params.punchedAtIso,
      _reason: params.reason,
      _notes: params.notes ?? null,
    });
    return { data, error };
  },

  /**
   * Edita hora/tipo de um registo (admin). O motivo fica no histórico.
   */
  updateEntry: async (params: {
    entryId: string;
    entryType: EntryType;
    punchedAtIso: string;
    reason: string;
    notes?: string | null;
  }) => {
    const { error } = await supabase.rpc('time_clock_admin_update_entry', {
      _entry_id: params.entryId,
      _entry_type: params.entryType,
      _punched_at: params.punchedAtIso,
      _reason: params.reason,
      _notes: params.notes ?? null,
    });
    return { success: !error, error };
  },

  /**
   * Anula ('voided') ou valida/restaura ('valid') um registo (admin).
   */
  setStatus: async (entryId: string, status: 'voided' | 'valid', reason: string) => {
    const { error } = await supabase.rpc('time_clock_admin_set_status', {
      _entry_id: entryId,
      _status: status,
      _reason: reason,
    });
    return { success: !error, error };
  },
};
