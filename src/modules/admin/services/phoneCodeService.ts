import { supabase } from '@/integrations/supabase/client';

export interface PhoneCodes {
  pin: string | null;
  puk: string | null;
}

/** PIN e PUK dos cartões SIM: estão cifrados na BD e só se leem quando são precisos. */
export const phoneCodeService = {
  codes: async (phoneIds: string[]): Promise<Map<string, PhoneCodes>> => {
    if (phoneIds.length === 0) return new Map();
    const { data, error } = await supabase.rpc('phone_codes', { _phone_ids: phoneIds });
    if (error) return new Map();
    return new Map((data ?? []).map(row => [row.id, { pin: row.pin, puk: row.puk }]));
  },

  code: async (phoneId: string, code: keyof PhoneCodes): Promise<string | null> =>
    (await phoneCodeService.codes([phoneId])).get(phoneId)?.[code] ?? null,
};
