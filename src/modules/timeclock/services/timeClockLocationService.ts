import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { MapsCoordinates } from '@/lib/maps-link';
import { getAppBaseUrl } from '@/lib/utils';
import type { TimeClockLocation, TimeClockLocationInsert, TimeClockTag } from '@/lib/timeclock';

export type TimeClockLocationWithTags = TimeClockLocation & {
  company?: { name: string } | null;
  tags: TimeClockTag[];
};

export type TimeClockLocationUpdate = Partial<Omit<TimeClockLocationInsert, 'id'>>;

interface TagManageResponse {
  tag?: TimeClockTag;
  token?: string;
  coordinates?: MapsCoordinates;
  error?: string;
}

const TAG_COLUMNS =
  'id, location_id, label, tag_type, uid, is_active, last_used_at, created_at, created_by, updated_at';

/** URL a gravar numa tag estática. Curto de propósito (cabe numa NTAG213). */
export const buildStaticTagUrl = (token: string): string =>
  `${getAppBaseUrl()}/ponto/nfc?t=${encodeURIComponent(token)}`;

/** Modelo de URL a configurar numa NTAG 424 DNA (SDM mirroring em `e` e `c`). */
export const buildNtag424TemplateUrl = (): string =>
  `${getAppBaseUrl()}/ponto/nfc?e=00000000000000000000000000000000&c=0000000000000000`;

const invokeTagManage = async (
  body: Record<string, unknown>
): Promise<{ data: TagManageResponse | null; error: Error | null }> => {
  const { data, error } = await supabase.functions.invoke<TagManageResponse>('clock-tag-manage', {
    body,
  });
  if (!error) return { data, error: null };
  let message = error.message;
  if (error instanceof FunctionsHttpError) {
    try {
      const payload = (await error.context.json()) as TagManageResponse;
      if (payload?.error) message = payload.error;
    } catch {
      // mantém a mensagem original
    }
  }
  return { data: null, error: new Error(message) };
};

export const timeClockLocationService = {
  /**
   * Locais com empresa e tags associadas.
   */
  getAll: async () => {
    const { data, error } = await supabase
      .from('time_clock_locations')
      .select(`*, company:companies(name), tags:time_clock_tags(${TAG_COLUMNS})`)
      .order('name');
    return { data: (data ?? []) as TimeClockLocationWithTags[], error };
  },

  create: async (location: TimeClockLocationInsert) => {
    const { data, error } = await supabase
      .from('time_clock_locations')
      .insert(location)
      .select()
      .single();
    return { data, error };
  },

  update: async (id: string, location: TimeClockLocationUpdate) => {
    const { data, error } = await supabase
      .from('time_clock_locations')
      .update(location)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  delete: async (id: string) => {
    const { error } = await supabase.from('time_clock_locations').delete().eq('id', id);
    return { success: !error, error };
  },

  updateTag: async (id: string, changes: { label?: string; is_active?: boolean }) => {
    const { error } = await supabase.from('time_clock_tags').update(changes).eq('id', id);
    return { success: !error, error };
  },

  deleteTag: async (id: string) => {
    const { error } = await supabase.from('time_clock_tags').delete().eq('id', id);
    return { success: !error, error };
  },

  /**
   * Cria tag estática; o token só é devolvido agora (guarda-se apenas o hash).
   */
  createStaticTag: (locationId: string, label: string) =>
    invokeTagManage({ action: 'create_static', location_id: locationId, label }),

  /**
   * Gera novo token para a tag (a gravação antiga deixa de funcionar).
   */
  rotateStaticTag: (tagId: string) => invokeTagManage({ action: 'rotate_static', tag_id: tagId }),

  /**
   * Regista uma NTAG 424 DNA a partir de uma leitura (parâmetros e/c do URL).
   */
  registerNtag424: (locationId: string, label: string, e: string, c: string) =>
    invokeTagManage({ action: 'register_ntag424', location_id: locationId, label, e, c }),

  /**
   * Resolve um link curto do Google Maps (maps.app.goo.gl) em coordenadas.
   * O browser não consegue seguir estes redirecionamentos (CORS), o servidor sim.
   */
  resolveMapsLink: (url: string) => invokeTagManage({ action: 'resolve_maps_link', url }),
};
