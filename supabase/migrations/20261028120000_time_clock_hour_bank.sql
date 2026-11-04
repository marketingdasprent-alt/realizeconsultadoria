-- Banco de horas do ponto: horário igual para todos (horas por dia e dias da semana) e, por tipo
-- de ausência, se conta como tempo justificado ou se tem de ser compensado. Uma só linha
-- (id = true). O saldo é calculado na app (horas feitas + justificadas − previstas, por mês).
CREATE TABLE IF NOT EXISTS public.time_clock_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  daily_minutes integer NOT NULL DEFAULT 480 CHECK (daily_minutes BETWEEN 60 AND 720),
  -- 1 = segunda … 7 = domingo
  workdays smallint[] NOT NULL DEFAULT '{1,2,3,4,5}'
    CHECK (cardinality(workdays) BETWEEN 1 AND 7 AND workdays <@ '{1,2,3,4,5,6,7}'),
  -- { "<tipo>": "justified" | "compensate" }; tipo sem regra = justificada
  absence_rules jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(absence_rules) = 'object'),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.time_clock_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.time_clock_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Banco de horas: ler regras" ON public.time_clock_settings;
CREATE POLICY "Banco de horas: ler regras" ON public.time_clock_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Banco de horas: admins mudam regras" ON public.time_clock_settings;
CREATE POLICY "Banco de horas: admins mudam regras" ON public.time_clock_settings
  FOR UPDATE TO authenticated
  USING (public.rz_is_admin())
  WITH CHECK (public.rz_is_admin());

REVOKE ALL ON public.time_clock_settings FROM anon;
GRANT SELECT, UPDATE ON public.time_clock_settings TO authenticated;

-- Dias antes desta data não contam para o saldo (o ponto não era usado todos os dias).
ALTER TABLE public.time_clock_settings
  ADD COLUMN IF NOT EXISTS starts_on date NOT NULL DEFAULT '2026-11-01';
