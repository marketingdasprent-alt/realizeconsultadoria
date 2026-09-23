-- =============================================================================
-- Controlo de Ponto (registo de tempos de trabalho)
-- =============================================================================
-- Modelo:
--   time_clock_locations      → locais de trabalho (coordenadas + raio, por empresa)
--   time_clock_tags           → tags NFC afixadas em cada local
--   time_clock_entries        → registos de ponto (entrada/saída) = folha de ponto
--   time_clock_entry_history  → histórico imutável de TODAS as alterações
--   time_clock_attempts       → tentativas rejeitadas (fora do raio, tag inválida, ...)
--
-- Regras de escrita:
--   * Colaboradores NUNCA escrevem diretamente: o registo passa pela edge
--     function `clock-punch` (service role), que valida tag + localização.
--   * Admins editam/criam/anulam via RPCs SECURITY DEFINER que exigem motivo.
--   * Um trigger grava cada INSERT/UPDATE/DELETE em time_clock_entry_history;
--     o histórico é append-only (nem o service role o consegue alterar).
--   * Registos não se apagam: anulam-se (status = 'voided').
--
-- Código do Trabalho, art. 202.º: o registo deve ser conservado 5 anos.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helpers de permissões
-- -----------------------------------------------------------------------------

-- Redefinido aqui (idempotente) caso 20260601121000 não tenha sido aplicada.
CREATE OR REPLACE FUNCTION public.is_super_admin_member(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_group_members agm
    JOIN admin_groups ag ON ag.id = agm.group_id
    WHERE agm.user_id = _user_id
      AND ag.is_super_admin = true
      AND ag.is_active = true
  )
$$;

-- Módulo 'timeclock', tópicos: 'view' (ver folha), 'edit' (editar registos),
-- 'locations' (gerir locais e tags). Super admins têm acesso total.
CREATE OR REPLACE FUNCTION public.has_timeclock_permission(
  _user_id UUID,
  _permission TEXT DEFAULT 'view',
  _topic_key TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin_member(_user_id)
    OR public.has_module_permission(_user_id, 'timeclock', _permission, _topic_key)
$$;

-- -----------------------------------------------------------------------------
-- 1. Locais de trabalho
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_clock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  -- Raio permitido em metros à volta das coordenadas
  radius_m INTEGER NOT NULL DEFAULT 50 CHECK (radius_m BETWEEN 10 AND 2000),
  -- Precisão GPS mínima exigida (accuracy reportada pelo dispositivo)
  max_accuracy_m INTEGER NOT NULL DEFAULT 100 CHECK (max_accuracy_m BETWEEN 5 AND 5000),
  -- Permite registar só com GPS (sem tag), dentro do raio
  allow_manual BOOLEAN NOT NULL DEFAULT true,
  -- Rejeitar (em vez de só sinalizar) quando o IP é VPN/proxy/datacenter
  block_vpn BOOLEAN NOT NULL DEFAULT false,
  -- IPs públicos da rede do local (ex.: Wi-Fi do escritório). IPv4 aceita CIDR.
  trusted_ips TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_locations_company
  ON public.time_clock_locations (company_id) WHERE is_active;

DROP TRIGGER IF EXISTS update_time_clock_locations_updated_at ON public.time_clock_locations;
CREATE TRIGGER update_time_clock_locations_updated_at
  BEFORE UPDATE ON public.time_clock_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 2. Tags NFC
-- -----------------------------------------------------------------------------
--   static  → NTAG213/215/216 com URL fixo ".../ponto/nfc?t=<token>".
--             Guarda-se apenas o SHA-256 do token. Clonável: usar como básico.
--   ntag424 → NTAG 424 DNA com SUN: URL ".../ponto/nfc?e=<picc>&c=<mac>" muda
--             a cada leitura (AES-128). Anti-clonagem + anti-replay (contador).
CREATE TABLE IF NOT EXISTS public.time_clock_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES public.time_clock_locations(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('static', 'ntag424')),
  token_hash TEXT UNIQUE,
  uid TEXT UNIQUE,
  last_counter INTEGER NOT NULL DEFAULT -1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_clock_tags_identity CHECK (
    (tag_type = 'static' AND token_hash IS NOT NULL)
    OR (tag_type = 'ntag424' AND uid IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_time_clock_tags_location ON public.time_clock_tags (location_id);

DROP TRIGGER IF EXISTS update_time_clock_tags_updated_at ON public.time_clock_tags;
CREATE TRIGGER update_time_clock_tags_updated_at
  BEFORE UPDATE ON public.time_clock_tags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. Registos de ponto (folha de ponto)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.time_clock_locations(id) ON DELETE SET NULL,
  tag_id UUID REFERENCES public.time_clock_tags(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('in', 'out')),
  punched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- nfc: via tag | gps: botão na app, só localização | admin: inserido por admin
  source TEXT NOT NULL CHECK (source IN ('nfc', 'gps', 'admin')),
  -- valid | flagged (sinais suspeitos, rever) | voided (anulado)
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'flagged', 'voided')),
  flags TEXT[] NOT NULL DEFAULT '{}',
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  distance_m DOUBLE PRECISION,
  ip_address TEXT,
  ip_country TEXT,
  ip_city TEXT,
  ip_is_proxy BOOLEAN,
  device_id TEXT,
  user_agent TEXT,
  notes TEXT,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_entries_employee_time
  ON public.time_clock_entries (employee_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_company_time
  ON public.time_clock_entries (company_id, punched_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_flagged
  ON public.time_clock_entries (punched_at DESC) WHERE status = 'flagged';
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_device
  ON public.time_clock_entries (device_id) WHERE device_id IS NOT NULL;

DROP TRIGGER IF EXISTS update_time_clock_entries_updated_at ON public.time_clock_entries;
CREATE TRIGGER update_time_clock_entries_updated_at
  BEFORE UPDATE ON public.time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 4. Histórico de alterações (append-only, sem FKs → sobrevive a eliminações)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_clock_entry_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL,
  employee_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'void', 'restore', 'review', 'delete')),
  changed_fields TEXT[] NOT NULL DEFAULT '{}',
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_history_entry
  ON public.time_clock_entry_history (entry_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_clock_history_employee
  ON public.time_clock_entry_history (employee_id, changed_at DESC);

CREATE OR REPLACE FUNCTION public.time_clock_actor_name(_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT name FROM public.profiles WHERE user_id = _user_id LIMIT 1),
    (SELECT name FROM public.employees WHERE user_id = _user_id LIMIT 1),
    (SELECT email FROM auth.users WHERE id = _user_id)
  )
$$;

CREATE OR REPLACE FUNCTION public.log_time_clock_entry_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old JSONB;
  _new JSONB;
  _action TEXT;
  _fields TEXT[] := '{}';
  _actor UUID;
  _reason TEXT := NULLIF(current_setting('app.time_clock_reason', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    _new := to_jsonb(NEW);
    _action := 'create';
    _actor := COALESCE(auth.uid(), NEW.created_by);
  ELSIF TG_OP = 'UPDATE' THEN
    _old := to_jsonb(OLD);
    _new := to_jsonb(NEW);
    SELECT COALESCE(array_agg(k ORDER BY k), '{}') INTO _fields
    FROM jsonb_object_keys(_new) AS k
    WHERE k NOT IN ('updated_at', 'updated_by')
      AND _new -> k IS DISTINCT FROM _old -> k;

    IF array_length(_fields, 1) IS NULL THEN
      RETURN NEW; -- nada relevante mudou
    END IF;

    _action := CASE
      WHEN NEW.status = 'voided' AND OLD.status <> 'voided' THEN 'void'
      WHEN OLD.status = 'voided' AND NEW.status <> 'voided' THEN 'restore'
      WHEN OLD.status = 'flagged' AND NEW.status = 'valid' AND _fields = ARRAY['status'] THEN 'review'
      ELSE 'update'
    END;
    _actor := COALESCE(auth.uid(), NEW.updated_by);
  ELSE
    _old := to_jsonb(OLD);
    _action := 'delete';
    _actor := auth.uid();
  END IF;

  INSERT INTO public.time_clock_entry_history (
    entry_id, employee_id, action, changed_fields, old_data, new_data,
    reason, changed_by, changed_by_name
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.employee_id, OLD.employee_id),
    _action, _fields, _old, _new,
    _reason, _actor, public.time_clock_actor_name(_actor)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_time_clock_entries_history ON public.time_clock_entries;
CREATE TRIGGER trg_time_clock_entries_history
  AFTER INSERT OR UPDATE OR DELETE ON public.time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION public.log_time_clock_entry_change();

CREATE OR REPLACE FUNCTION public.prevent_time_clock_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'O histórico do ponto é imutável';
END;
$$;

DROP TRIGGER IF EXISTS trg_time_clock_history_immutable ON public.time_clock_entry_history;
CREATE TRIGGER trg_time_clock_history_immutable
  BEFORE UPDATE OR DELETE ON public.time_clock_entry_history
  FOR EACH ROW EXECUTE FUNCTION public.prevent_time_clock_history_mutation();

-- -----------------------------------------------------------------------------
-- 5. Tentativas rejeitadas (auditoria antifraude)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_clock_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  user_id UUID,
  source TEXT,
  reason TEXT NOT NULL,
  flags TEXT[] NOT NULL DEFAULT '{}',
  location_id UUID REFERENCES public.time_clock_locations(id) ON DELETE SET NULL,
  tag_id UUID REFERENCES public.time_clock_tags(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy_m DOUBLE PRECISION,
  distance_m DOUBLE PRECISION,
  ip_address TEXT,
  ip_country TEXT,
  device_id TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_clock_attempts_time
  ON public.time_clock_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_clock_attempts_employee
  ON public.time_clock_attempts (employee_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.time_clock_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_clock_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_clock_entry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_clock_attempts ENABLE ROW LEVEL SECURITY;

-- Locais: admins do módulo veem; gestores de locais escrevem;
-- colaboradores veem os locais ativos da sua empresa (nome/raio no portal).
DROP POLICY IF EXISTS "Timeclock admins view locations" ON public.time_clock_locations;
CREATE POLICY "Timeclock admins view locations"
  ON public.time_clock_locations FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

DROP POLICY IF EXISTS "Employees view own company locations" ON public.time_clock_locations;
CREATE POLICY "Employees view own company locations"
  ON public.time_clock_locations FOR SELECT TO authenticated
  USING (is_active AND company_id = (SELECT public.get_employee_company_id(auth.uid())));

DROP POLICY IF EXISTS "Timeclock managers insert locations" ON public.time_clock_locations;
CREATE POLICY "Timeclock managers insert locations"
  ON public.time_clock_locations FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')));

DROP POLICY IF EXISTS "Timeclock managers update locations" ON public.time_clock_locations;
CREATE POLICY "Timeclock managers update locations"
  ON public.time_clock_locations FOR UPDATE TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')))
  WITH CHECK ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')));

DROP POLICY IF EXISTS "Timeclock managers delete locations" ON public.time_clock_locations;
CREATE POLICY "Timeclock managers delete locations"
  ON public.time_clock_locations FOR DELETE TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')));

-- Tags: só admins. INSERT só pela edge function `clock-tag-manage` (gera o
-- token e guarda o hash), por isso não há política de INSERT.
DROP POLICY IF EXISTS "Timeclock admins view tags" ON public.time_clock_tags;
CREATE POLICY "Timeclock admins view tags"
  ON public.time_clock_tags FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

DROP POLICY IF EXISTS "Timeclock managers update tags" ON public.time_clock_tags;
CREATE POLICY "Timeclock managers update tags"
  ON public.time_clock_tags FOR UPDATE TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')))
  WITH CHECK ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')));

DROP POLICY IF EXISTS "Timeclock managers delete tags" ON public.time_clock_tags;
CREATE POLICY "Timeclock managers delete tags"
  ON public.time_clock_tags FOR DELETE TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'execute', 'locations')));

-- Nota: token_hash é SHA-256 de 192 bits aleatórios (não reversível); o
-- token em claro só é mostrado uma vez ao admin, na criação/rotação.

-- Registos: leitura para o próprio colaborador e admins do módulo.
-- Sem políticas de escrita: tudo passa pela edge function ou pelos RPCs.
DROP POLICY IF EXISTS "Employees view own time entries" ON public.time_clock_entries;
CREATE POLICY "Employees view own time entries"
  ON public.time_clock_entries FOR SELECT TO authenticated
  USING (employee_id = (SELECT public.get_employee_id_from_user(auth.uid())));

DROP POLICY IF EXISTS "Timeclock admins view time entries" ON public.time_clock_entries;
CREATE POLICY "Timeclock admins view time entries"
  ON public.time_clock_entries FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

-- Histórico e tentativas: só leitura para admins do módulo.
DROP POLICY IF EXISTS "Timeclock admins view history" ON public.time_clock_entry_history;
CREATE POLICY "Timeclock admins view history"
  ON public.time_clock_entry_history FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

DROP POLICY IF EXISTS "Timeclock admins view attempts" ON public.time_clock_attempts;
CREATE POLICY "Timeclock admins view attempts"
  ON public.time_clock_attempts FOR SELECT TO authenticated
  USING ((SELECT public.has_timeclock_permission(auth.uid(), 'view')));

-- -----------------------------------------------------------------------------
-- 7. RPCs de administração (motivo obrigatório → fica no histórico)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.time_clock_admin_create_entry(
  _employee_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _location_id UUID DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _id UUID;
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;
  IF _entry_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de registo inválido';
  END IF;
  IF _punched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registar horas no futuro';
  END IF;

  SELECT company_id INTO _company_id FROM public.employees WHERE id = _employee_id;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Colaborador não encontrado';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  INSERT INTO public.time_clock_entries (
    employee_id, company_id, location_id, entry_type, punched_at,
    source, status, notes, created_by, updated_by
  ) VALUES (
    _employee_id, _company_id, _location_id, _entry_type, _punched_at,
    'admin', 'valid', NULLIF(trim(COALESCE(_notes, '')), ''), auth.uid(), auth.uid()
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$$;

CREATE OR REPLACE FUNCTION public.time_clock_admin_update_entry(
  _entry_id UUID,
  _entry_type TEXT,
  _punched_at TIMESTAMPTZ,
  _reason TEXT,
  _notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;
  IF _entry_type NOT IN ('in', 'out') THEN
    RAISE EXCEPTION 'Tipo de registo inválido';
  END IF;
  IF _punched_at > now() + interval '5 minutes' THEN
    RAISE EXCEPTION 'Não é possível registar horas no futuro';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  UPDATE public.time_clock_entries
  SET entry_type = _entry_type,
      punched_at = _punched_at,
      notes = NULLIF(trim(COALESCE(_notes, '')), ''),
      updated_by = auth.uid()
  WHERE id = _entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
END;
$$;

-- _status: 'voided' (anular) | 'valid' (restaurar / marcar como revisto)
CREATE OR REPLACE FUNCTION public.time_clock_admin_set_status(
  _entry_id UUID,
  _status TEXT,
  _reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_timeclock_permission(auth.uid(), 'execute', 'edit') THEN
    RAISE EXCEPTION 'Sem permissão para editar a folha de ponto' USING ERRCODE = '42501';
  END IF;
  IF _status NOT IN ('voided', 'valid') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  IF length(trim(COALESCE(_reason, ''))) < 3 THEN
    RAISE EXCEPTION 'Indique o motivo da alteração';
  END IF;

  PERFORM set_config('app.time_clock_reason', trim(_reason), true);

  UPDATE public.time_clock_entries
  SET status = _status,
      updated_by = auth.uid()
  WHERE id = _entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registo não encontrado';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.time_clock_admin_create_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.time_clock_admin_update_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.time_clock_admin_set_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_create_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_update_entry(UUID, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.time_clock_admin_set_status(UUID, TEXT, TEXT) TO authenticated;

-- Helper de permissões: usado pelas políticas (authenticated) e pela edge function
-- (service_role); não precisa de estar exposto a pedidos anónimos.
REVOKE EXECUTE ON FUNCTION public.has_timeclock_permission(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_timeclock_permission(UUID, TEXT, TEXT) TO authenticated, service_role;

-- Funções internas do trigger não precisam de ser chamáveis via API.
REVOKE EXECUTE ON FUNCTION public.log_time_clock_entry_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.time_clock_actor_name(UUID) FROM PUBLIC, anon, authenticated;
