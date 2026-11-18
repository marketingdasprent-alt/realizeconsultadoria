-- Multiempresa: migração-base (espelho da camada que já existe na base real).
--
-- A camada multiempresa (pertenças, grupos, partilhas entre empresas, administradores da plataforma,
-- acesso de suporte, catálogo de capacidades, interruptores e auditoria cruzada) foi aplicada
-- diretamente na base e nunca passou pelo repo. Este ficheiro limita-se a espelhá-la, para o repo,
-- os ambientes de teste e as bases novas ficarem iguais à base real. NÃO altera comportamento.
--
-- Idempotente: numa base onde a camada já existe não tem efeito; numa base vazia cria tudo.
-- Não inclui dados de produção (grupos, pertenças, administradores da plataforma, códigos de partilha).
-- Não liga rz_sync_membership a employees (fica só a função, como na base real).
--
-- Fonte: consultas só de leitura à base real (colunas, constraints, índices, políticas, ACL e código
-- das funções), incluindo a segunda leitura que fechou as lacunas (rz_touch_updated_at,
-- rz_revoke_share, companies.status/plan/registered_at, constraints e identidade das sequências).
-- Divergências conhecidas e intencionais: ver o fim do ficheiro.
-- Não aplicar por cima da base real sem a marcar antes como já aplicada no histórico de migrações.

-- ============================================================================================
-- 0. Extensões usadas pela camada (já existem na base real)
-- ============================================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================================
-- 1. Colunas que as migrações do repo não criam (companies e employees)
--    Só tipos: os valores por omissão e as restrições não constam da fonte.
-- ============================================================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS plan text,
  ADD COLUMN IF NOT EXISTS registered_at timestamptz;

DO $companies_check$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'companies_status_check'
                    AND conrelid = 'public.companies'::regclass) THEN
    ALTER TABLE public.companies ADD CONSTRAINT companies_status_check
      CHECK ((status = ANY (ARRAY['ativa'::text, 'suspensa'::text, 'arquivada'::text])));
  END IF;
END
$companies_check$;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS safety_checkup_date date,
  ADD COLUMN IF NOT EXISTS safety_checkup_renewal_months integer DEFAULT 12;

-- ============================================================================================
-- 2. Tabelas
-- ============================================================================================
CREATE TABLE IF NOT EXISTS public.capability_catalog (
  capability  text    NOT NULL,
  module      text    NOT NULL,
  kind        text    NOT NULL,
  grantable   boolean NOT NULL DEFAULT false,
  sensitive   boolean NOT NULL DEFAULT false,
  min_role    text    NOT NULL,
  description text    NOT NULL
);

CREATE TABLE IF NOT EXISTS public.company_groups (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  name                  text        NOT NULL,
  created_by_company_id uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_group_members (
  group_id   uuid        NOT NULL,
  company_id uuid        NOT NULL,
  status     text        NOT NULL DEFAULT 'ativo',
  origin     text        NOT NULL DEFAULT 'pedido',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz
);

CREATE TABLE IF NOT EXISTS public.company_join_requests (
  id                   uuid        NOT NULL DEFAULT gen_random_uuid(),
  requester_company_id uuid        NOT NULL,
  target_company_id    uuid        NOT NULL,
  requested_by         uuid        NOT NULL,
  proposed             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  status               text        NOT NULL DEFAULT 'pedido',
  decided_by           uuid,
  decided_at           timestamptz,
  decision_note        text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  expires_at           timestamptz NOT NULL DEFAULT (now() + '14 days'::interval)
);

CREATE TABLE IF NOT EXISTS public.company_memberships (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  company_id  uuid        NOT NULL,
  user_id     uuid        NOT NULL,
  employee_id uuid,
  role        text        NOT NULL,
  origin      text        NOT NULL,
  status      text        NOT NULL DEFAULT 'ativo',
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz
);

CREATE TABLE IF NOT EXISTS public.company_share_codes (
  company_id uuid        NOT NULL,
  share_code text        NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.company_shares (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid(),
  owner_company_id    uuid        NOT NULL,
  grantee_company_id  uuid        NOT NULL,
  capability          text        NOT NULL,
  status              text        NOT NULL DEFAULT 'pedido',
  origin              text        NOT NULL DEFAULT 'pedido',
  request_id          uuid,
  approved_by         uuid,
  approved_at         timestamptz,
  revoked_by          uuid,
  revoked_at          timestamptz,
  revoke_reason       text,
  legacy_confirmed_at timestamptz,
  legacy_due_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Auditoria cruzada: particionada por mês (coluna "at"), com partição por omissão.
CREATE SEQUENCE IF NOT EXISTS public.cross_company_audit_id_seq;

CREATE TABLE IF NOT EXISTS public.cross_company_audit (
  id               bigint      NOT NULL DEFAULT nextval('public.cross_company_audit_id_seq'::regclass),
  at               timestamptz NOT NULL DEFAULT now(),
  actor_user_id    uuid,
  actor_company_id uuid,
  owner_company_id uuid,
  capability       text,
  action           text        NOT NULL,
  resource_type    text,
  resource_id      uuid,
  share_id         uuid,
  support_grant_id uuid,
  request_id       text,
  ip               inet,
  CONSTRAINT cross_company_audit_pkey PRIMARY KEY (id, at)
) PARTITION BY RANGE (at);

ALTER SEQUENCE public.cross_company_audit_id_seq OWNED BY public.cross_company_audit.id;

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id      uuid        NOT NULL,
  active       boolean     NOT NULL DEFAULT true,
  mfa_required boolean     NOT NULL DEFAULT true,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- O id é gerado pela base (as funções inserem sem id).
CREATE TABLE IF NOT EXISTS public.share_request_attempts (
  id         bigint      GENERATED ALWAYS AS IDENTITY,
  company_id uuid,
  ip         inet,
  at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_access_grants (
  id                     uuid        NOT NULL DEFAULT gen_random_uuid(),
  company_id             uuid        NOT NULL,
  platform_admin_user_id uuid        NOT NULL,
  granted_by             uuid        NOT NULL,
  scope                  text[]      NOT NULL,
  reason                 text        NOT NULL,
  starts_at              timestamptz NOT NULL DEFAULT now(),
  expires_at             timestamptz NOT NULL,
  revoked_at             timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.module_flags (
  module     text        NOT NULL,
  enabled    boolean     NOT NULL DEFAULT false,
  changed_by uuid,
  changed_at timestamptz,
  note       text
);

-- ============================================================================================
-- 3. Constraints (só se ainda não existirem)
--    As definições são as da base real. Para company_share_codes e share_request_attempts a fonte
--    só traz os índices: PK e UNIQUE inferidos deles.
-- ============================================================================================
DO $constraints$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('capability_catalog', 'capability_catalog_pkey',
        $d$PRIMARY KEY (capability)$d$),
      ('capability_catalog', 'capability_catalog_capability_check',
        $d$CHECK ((capability ~ '^[a-z]+(\.[a-z_]+)+$'::text))$d$),
      ('capability_catalog', 'capability_catalog_kind_check',
        $d$CHECK ((kind = ANY (ARRAY['read'::text, 'write'::text, 'special'::text])))$d$),
      ('capability_catalog', 'capability_catalog_min_role_check',
        $d$CHECK ((min_role = ANY (ARRAY['colaborador'::text, 'gestor'::text, 'admin'::text])))$d$),
      ('capability_catalog', 'capability_catalog_module_check',
        $d$CHECK ((module = ANY (ARRAY['directory'::text, 'tickets'::text, 'access'::text, 'mail'::text, 'chat'::text, 'tasks'::text, 'equipment'::text, 'feed'::text, 'hr'::text, 'finance'::text, 'docs'::text])))$d$),

      ('company_groups', 'company_groups_pkey',
        $d$PRIMARY KEY (id)$d$),
      ('company_groups', 'company_groups_created_by_company_id_fkey',
        $d$FOREIGN KEY (created_by_company_id) REFERENCES public.companies(id) ON DELETE SET NULL$d$),

      ('company_group_members', 'company_group_members_pkey',
        $d$PRIMARY KEY (group_id, company_id)$d$),
      ('company_group_members', 'company_group_members_company_id_fkey',
        $d$FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('company_group_members', 'company_group_members_group_id_fkey',
        $d$FOREIGN KEY (group_id) REFERENCES public.company_groups(id) ON DELETE CASCADE$d$),
      ('company_group_members', 'company_group_members_origin_check',
        $d$CHECK ((origin = ANY (ARRAY['pedido'::text, 'migracao'::text])))$d$),
      ('company_group_members', 'company_group_members_status_check',
        $d$CHECK ((status = ANY (ARRAY['ativo'::text, 'saiu'::text])))$d$),

      ('company_join_requests', 'company_join_requests_pkey',
        $d$PRIMARY KEY (id)$d$),
      ('company_join_requests', 'company_join_requests_check',
        $d$CHECK ((requester_company_id <> target_company_id))$d$),
      ('company_join_requests', 'company_join_requests_proposed_check',
        $d$CHECK ((jsonb_typeof(proposed) = 'object'::text))$d$),
      ('company_join_requests', 'company_join_requests_requester_company_id_fkey',
        $d$FOREIGN KEY (requester_company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('company_join_requests', 'company_join_requests_status_check',
        $d$CHECK ((status = ANY (ARRAY['pedido'::text, 'aprovado'::text, 'recusado'::text, 'cancelado'::text, 'expirado'::text])))$d$),
      ('company_join_requests', 'company_join_requests_target_company_id_fkey',
        $d$FOREIGN KEY (target_company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),

      ('company_memberships', 'company_memberships_pkey',
        $d$PRIMARY KEY (id)$d$),
      ('company_memberships', 'company_memberships_company_id_user_id_key',
        $d$UNIQUE (company_id, user_id)$d$),
      ('company_memberships', 'company_memberships_company_id_fkey',
        $d$FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('company_memberships', 'company_memberships_employee_id_fkey',
        $d$FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL$d$),
      ('company_memberships', 'company_memberships_origin_check',
        $d$CHECK ((origin = ANY (ARRAY['registo'::text, 'convite'::text, 'migracao'::text, 'legado'::text, 'suporte'::text])))$d$),
      ('company_memberships', 'company_memberships_role_check',
        $d$CHECK ((role = ANY (ARRAY['admin'::text, 'gestor'::text, 'colaborador'::text])))$d$),
      ('company_memberships', 'company_memberships_status_check',
        $d$CHECK ((status = ANY (ARRAY['ativo'::text, 'suspenso'::text, 'removido'::text])))$d$),
      ('company_memberships', 'company_memberships_user_id_fkey',
        $d$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$d$),

      ('company_share_codes', 'company_share_codes_pkey',
        $d$PRIMARY KEY (company_id)$d$),
      ('company_share_codes', 'company_share_codes_share_code_key',
        $d$UNIQUE (share_code)$d$),
      ('company_share_codes', 'company_share_codes_share_code_check',
        $d$CHECK ((share_code ~ '^[A-HJ-NP-Z2-9]{10}$'::text))$d$),
      ('company_share_codes', 'company_share_codes_company_id_fkey',
        $d$FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),

      -- cross_company_audit_pkey é criada na própria tabela
      ('cross_company_audit', 'cross_company_audit_action_check',
        $d$CHECK ((action = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text, 'export'::text, 'reveal'::text, 'support_read'::text, 'support_grant'::text, 'support_revoke'::text, 'share_request'::text, 'share_approve'::text, 'share_revoke'::text, 'flag_change'::text, 'super_admin_access'::text])))$d$),

      ('module_flags', 'module_flags_pkey',
        $d$PRIMARY KEY (module)$d$),

      ('company_shares', 'company_shares_pkey',
        $d$PRIMARY KEY (id)$d$),
      ('company_shares', 'company_shares_capability_fkey',
        $d$FOREIGN KEY (capability) REFERENCES public.capability_catalog(capability)$d$),
      ('company_shares', 'company_shares_check',
        $d$CHECK ((owner_company_id <> grantee_company_id))$d$),
      ('company_shares', 'company_shares_check1',
        $d$CHECK (((status <> 'aprovado'::text) OR (approved_at IS NOT NULL)))$d$),
      ('company_shares', 'company_shares_check2',
        $d$CHECK (((status <> 'revogado'::text) OR (revoked_at IS NOT NULL)))$d$),
      ('company_shares', 'company_shares_grantee_company_id_fkey',
        $d$FOREIGN KEY (grantee_company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('company_shares', 'company_shares_origin_check',
        $d$CHECK ((origin = ANY (ARRAY['pedido'::text, 'legado'::text])))$d$),
      ('company_shares', 'company_shares_owner_company_id_fkey',
        $d$FOREIGN KEY (owner_company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('company_shares', 'company_shares_request_id_fkey',
        $d$FOREIGN KEY (request_id) REFERENCES public.company_join_requests(id) ON DELETE SET NULL$d$),
      ('company_shares', 'company_shares_status_check',
        $d$CHECK ((status = ANY (ARRAY['pedido'::text, 'aprovado'::text, 'revogado'::text])))$d$),

      ('platform_admins', 'platform_admins_pkey',
        $d$PRIMARY KEY (user_id)$d$),
      ('platform_admins', 'platform_admins_user_id_fkey',
        $d$FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE$d$),

      ('share_request_attempts', 'share_request_attempts_pkey',
        $d$PRIMARY KEY (id)$d$),

      ('support_access_grants', 'support_access_grants_pkey',
        $d$PRIMARY KEY (id)$d$),
      ('support_access_grants', 'support_access_grants_check',
        $d$CHECK (((expires_at > starts_at) AND (expires_at <= (starts_at + '24:00:00'::interval))))$d$),
      ('support_access_grants', 'support_access_grants_company_id_fkey',
        $d$FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE$d$),
      ('support_access_grants', 'support_access_grants_reason_check',
        $d$CHECK ((length(TRIM(BOTH FROM reason)) > 0))$d$),
      ('support_access_grants', 'support_access_grants_scope_check',
        $d$CHECK ((cardinality(scope) > 0))$d$)
    ) AS t(tbl, cname, def)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conname = r.cname
        AND c.conrelid = to_regclass(format('public.%I', r.tbl))
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s', r.tbl, r.cname, r.def);
    END IF;
  END LOOP;
END
$constraints$;

-- ============================================================================================
-- 4. Índices
-- ============================================================================================
CREATE INDEX IF NOT EXISTS company_group_members_company_idx
  ON public.company_group_members USING btree (company_id) WHERE (status = 'ativo'::text);

CREATE UNIQUE INDEX IF NOT EXISTS company_join_requests_pending_uq
  ON public.company_join_requests USING btree (requester_company_id, target_company_id) WHERE (status = 'pedido'::text);
CREATE INDEX IF NOT EXISTS company_join_requests_target_idx
  ON public.company_join_requests USING btree (target_company_id, status);

CREATE INDEX IF NOT EXISTS company_memberships_company_role_idx
  ON public.company_memberships USING btree (company_id, role) WHERE (status = 'ativo'::text);
CREATE INDEX IF NOT EXISTS company_memberships_user_status_idx
  ON public.company_memberships USING btree (user_id, status);

CREATE INDEX IF NOT EXISTS company_shares_grantee_idx
  ON public.company_shares USING btree (grantee_company_id, status, capability);
CREATE UNIQUE INDEX IF NOT EXISTS company_shares_live_uq
  ON public.company_shares USING btree (owner_company_id, grantee_company_id, capability)
  WHERE (status = ANY (ARRAY['pedido'::text, 'aprovado'::text]));
CREATE INDEX IF NOT EXISTS company_shares_owner_idx
  ON public.company_shares USING btree (owner_company_id, status);

-- Índice particionado: as partições (existentes e futuras) herdam-no.
CREATE INDEX IF NOT EXISTS cross_company_audit_owner_at_idx
  ON public.cross_company_audit USING btree (owner_company_id, at DESC);

CREATE INDEX IF NOT EXISTS share_request_attempts_company_idx
  ON public.share_request_attempts USING btree (company_id, at);
CREATE INDEX IF NOT EXISTS share_request_attempts_ip_idx
  ON public.share_request_attempts USING btree (ip, at);

CREATE INDEX IF NOT EXISTS support_access_grants_live_idx
  ON public.support_access_grants USING btree (platform_admin_user_id, company_id) WHERE (revoked_at IS NULL);

-- ============================================================================================
-- 5. Funções rz_* da camada (ordem: o que as outras usam vem primeiro)
-- ============================================================================================

-- ---- Base: erros, utilizador, ordem dos papéis, IP ------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_fail(p_code text, p_detail text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_state  text;
  v_detail text;
BEGIN
  v_state := CASE p_code
    WHEN 'not_authenticated' THEN '28000'
    WHEN 'forbidden' THEN '42501'
    WHEN 'not_company_admin' THEN '42501'
    WHEN 'not_platform_admin' THEN '42501'
    WHEN 'module_not_grantable' THEN '42501'
    WHEN 'reauth_required' THEN 'RZ401'
    WHEN 'invalid_argument' THEN '22023'
    WHEN 'unknown_capability' THEN '22023'
    WHEN 'nothing_to_grant' THEN '22023'
    WHEN 'reason_required' THEN '22023'
    WHEN 'duration_too_long' THEN '22023'
    WHEN 'not_found' THEN '02000'
    WHEN 'request_not_pending' THEN '55000'
    WHEN 'request_expired' THEN '55000'
    WHEN 'share_not_active' THEN '55000'
    WHEN 'already_pending' THEN '55000'
    WHEN 'already_shared' THEN '55000'
    WHEN 'last_admin' THEN '55000'
    WHEN 'rate_limited' THEN 'RZ429'
    WHEN 'cross_company_violation' THEN '23514'
    ELSE 'P0001'
  END;
  v_detail := coalesce(p_detail, CASE p_code
    WHEN 'not_authenticated' THEN 'É preciso iniciar sessão.'
    WHEN 'forbidden' THEN 'Não tem permissão para esta ação.'
    WHEN 'not_company_admin' THEN 'Só o administrador da empresa pode fazer isto.'
    WHEN 'not_platform_admin' THEN 'Só um administrador da plataforma pode fazer isto.'
    WHEN 'module_not_grantable' THEN 'Esta capacidade não se pode partilhar.'
    WHEN 'reauth_required' THEN 'Confirme a sua palavra-passe para continuar.'
    WHEN 'invalid_argument' THEN 'Os dados enviados não são válidos.'
    WHEN 'unknown_capability' THEN 'Capacidade desconhecida.'
    WHEN 'nothing_to_grant' THEN 'Escolha pelo menos uma partilha.'
    WHEN 'reason_required' THEN 'Indique o motivo.'
    WHEN 'duration_too_long' THEN 'A duração tem de ser entre 1 e 24 horas.'
    WHEN 'not_found' THEN 'Não encontrado.'
    WHEN 'request_not_pending' THEN 'Este pedido já não está pendente.'
    WHEN 'request_expired' THEN 'Este pedido expirou.'
    WHEN 'share_not_active' THEN 'Esta partilha já não está ativa.'
    WHEN 'already_pending' THEN 'Já existe um pedido pendente.'
    WHEN 'already_shared' THEN 'Esta partilha já existe.'
    WHEN 'last_admin' THEN 'Uma empresa tem de ter pelo menos um administrador.'
    WHEN 'rate_limited' THEN 'Demasiadas tentativas. Tente novamente mais tarde.'
    WHEN 'cross_company_violation' THEN 'Esta operação mistura dados de empresas diferentes.'
    ELSE NULL
  END);
  RAISE EXCEPTION '%', p_code USING ERRCODE = v_state, DETAIL = v_detail;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_uid()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.rz_fail('not_authenticated');
  END IF;
  RETURN v_uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_role_rank(p_role text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'pg_catalog'
AS $function$
  SELECT CASE p_role WHEN 'colaborador' THEN 1 WHEN 'gestor' THEN 2 WHEN 'admin' THEN 3 ELSE 0 END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_request_ip()
 RETURNS inet
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
BEGIN
  RETURN nullif(trim(split_part(
    coalesce(v_headers ->> 'cf-connecting-ip', v_headers ->> 'x-forwarded-for', ''), ',', 1)), '')::inet;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_gen_share_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_alpha constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bytes bytea := gen_random_bytes(10);
  v_code  text := '';
  i       integer;
BEGIN
  FOR i IN 0..9 LOOP
    v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % 32) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$function$;

-- ---- Funções de gatilho ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_touch_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_audit_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RAISE EXCEPTION 'audit_immutable'
    USING ERRCODE = '42501', DETAIL = 'A auditoria só aceita novas linhas.';
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_membership_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'membership_immutable'
      USING ERRCODE = '23514', DETAIL = 'A empresa e a conta de uma pertença não se alteram.';
  END IF;

  IF NEW.status = 'removido' AND OLD.status <> 'removido' THEN
    NEW.removed_at := coalesce(NEW.removed_at, now());
  ELSIF NEW.status <> 'removido' THEN
    NEW.removed_at := NULL;
  END IF;

  IF OLD.role = 'admin' AND OLD.status = 'ativo' AND (NEW.role <> 'admin' OR NEW.status <> 'ativo') THEN
    -- Serializa por empresa: duas pessoas a baixar dois admins ao mesmo tempo não esvaziam a empresa.
    PERFORM pg_advisory_xact_lock(hashtextextended(OLD.company_id::text, 0));
    IF NOT EXISTS (
      SELECT 1 FROM public.company_memberships m
      WHERE m.company_id = OLD.company_id AND m.role = 'admin' AND m.status = 'ativo' AND m.id <> OLD.id
    ) THEN
      RAISE EXCEPTION 'last_admin'
        USING ERRCODE = '55000', DETAIL = 'Uma empresa tem de ter pelo menos um administrador ativo.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_share_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (SELECT 1 FROM public.capability_catalog c WHERE c.capability = NEW.capability AND c.grantable) THEN
      RAISE EXCEPTION 'module_not_grantable'
        USING ERRCODE = '42501', DETAIL = 'Esta capacidade não se pode partilhar.';
    END IF;
    IF NEW.status = 'revogado' THEN
      RAISE EXCEPTION 'invalid_share_transition'
        USING ERRCODE = '55000', DETAIL = 'Uma partilha não pode nascer revogada.';
    END IF;
    IF NEW.status = 'aprovado' THEN
      NEW.approved_at := coalesce(NEW.approved_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.owner_company_id <> OLD.owner_company_id
     OR NEW.grantee_company_id <> OLD.grantee_company_id
     OR NEW.capability <> OLD.capability
     OR NEW.origin <> OLD.origin THEN
    RAISE EXCEPTION 'share_immutable'
      USING ERRCODE = '23514', DETAIL = 'O dono, o beneficiário, a capacidade e a origem não se alteram.';
  END IF;

  IF NEW.status <> OLD.status THEN
    IF NOT ((OLD.status = 'pedido' AND NEW.status IN ('aprovado','revogado'))
         OR (OLD.status = 'aprovado' AND NEW.status = 'revogado')) THEN
      RAISE EXCEPTION 'invalid_share_transition'
        USING ERRCODE = '55000', DETAIL = format('Não se pode passar de %s a %s.', OLD.status, NEW.status);
    END IF;
    IF NEW.status = 'aprovado' THEN
      NEW.approved_at := coalesce(NEW.approved_at, now());
    ELSIF NEW.status = 'revogado' THEN
      NEW.revoked_at := coalesce(NEW.revoked_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Só a função; NÃO é ligada a employees (como na base real).
CREATE OR REPLACE FUNCTION public.rz_sync_membership()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.user_id IS NOT NULL
     AND (OLD.user_id IS DISTINCT FROM NEW.user_id OR OLD.company_id IS DISTINCT FROM NEW.company_id) THEN
    UPDATE public.company_memberships
       SET status = 'removido'
     WHERE company_id = OLD.company_id AND user_id = OLD.user_id
       AND role <> 'admin' AND status <> 'removido';
  END IF;

  IF NEW.user_id IS NOT NULL THEN
    INSERT INTO public.company_memberships (company_id, user_id, employee_id, role, origin, status)
    VALUES (NEW.company_id, NEW.user_id, NEW.id, 'colaborador', 'migracao',
            CASE WHEN NEW.is_active THEN 'ativo' ELSE 'suspenso' END)
    ON CONFLICT (company_id, user_id) DO UPDATE
      SET employee_id = EXCLUDED.employee_id,
          status = CASE WHEN public.company_memberships.role = 'admin'
                        THEN public.company_memberships.status ELSE EXCLUDED.status END;
  END IF;
  RETURN NEW;
END;
$function$;

-- ---- Quem é quem: super admin, administrador de empresa ---------------------------------------
CREATE OR REPLACE FUNCTION public.rz_is_super_admin_for(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE pa.active
      AND pa.user_id = ANY (public.rz_identity_ids(p_user))
      AND (NOT pa.mfa_required
           OR p_user IS DISTINCT FROM auth.uid()
           OR coalesce(auth.jwt() ->> 'aal', '') = 'aal2')
  );
$function$;

CREATE OR REPLACE FUNCTION public.rz_is_platform_admin_for(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin_for(p_user);
$function$;

CREATE OR REPLACE FUNCTION public.rz_is_super_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin_for(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.rz_is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_super_admin_for(auth.uid());
$function$;

CREATE OR REPLACE FUNCTION public.rz_is_company_admin_for(p_user uuid, p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  -- D14: o super admin conta como admin de qualquer empresa (as RPC auditam quando age fora da sua).
  SELECT p_user IS NOT NULL AND p_company IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.company_memberships cm
      WHERE cm.company_id = p_company
        AND cm.role = 'admin' AND cm.status = 'ativo'
        AND cm.user_id = ANY (public.rz_identity_ids(p_user))
    )
    OR public.rz_is_super_admin_for(p_user)
  );
$function$;

CREATE OR REPLACE FUNCTION public.rz_is_company_admin(company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_is_company_admin_for(auth.uid(), company);
$function$;

-- ---- Auditoria cruzada ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_audit_cross(p_actor_user uuid, p_actor_company uuid, p_owner_company uuid, p_capability text, p_action text, p_resource_type text DEFAULT NULL::text, p_resource_id uuid DEFAULT NULL::uuid, p_share_id uuid DEFAULT NULL::uuid, p_support_grant uuid DEFAULT NULL::uuid, p_request_id text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  INSERT INTO public.cross_company_audit
    (actor_user_id, actor_company_id, owner_company_id, capability, action,
     resource_type, resource_id, share_id, support_grant_id, request_id, ip)
  VALUES
    (p_actor_user, p_actor_company, p_owner_company, p_capability, p_action,
     p_resource_type, p_resource_id, p_share_id, p_support_grant, p_request_id, public.rz_request_ip());
$function$;

CREATE OR REPLACE FUNCTION public.rz_audit_ensure_partitions()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_first date := date_trunc('month', timezone('UTC', now()))::date;
  v_from  date;
  v_to    date;
  v_name  text;
  i       integer;
BEGIN
  FOR i IN 0..3 LOOP
    v_from := (v_first + make_interval(months => i))::date;
    v_to   := (v_first + make_interval(months => i + 1))::date;
    v_name := 'cross_company_audit_' || to_char(v_from, 'YYYYMM');
    BEGIN
      EXECUTE format(
        'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.cross_company_audit FOR VALUES FROM (%L) TO (%L)',
        v_name, to_char(v_from, 'YYYY-MM-DD') || ' 00:00:00+00', to_char(v_to, 'YYYY-MM-DD') || ' 00:00:00+00');
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_name);
    EXCEPTION WHEN OTHERS THEN
      -- Por exemplo, a partição por omissão já tem linhas desse mês: avisa e segue.
      RAISE WARNING 'rz_audit_ensure_partitions: % não foi criada (%)', v_name, SQLERRM;
    END;
  END LOOP;
END;
$function$;

-- ---- Asserções (uso interno) ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_assert_admin(p_company uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_uid uuid := public.rz_uid();
BEGIN
  IF p_company IS NULL THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  IF EXISTS (
       SELECT 1 FROM public.company_memberships cm
       WHERE cm.company_id = p_company AND cm.role = 'admin' AND cm.status = 'ativo'
         AND cm.user_id = ANY (public.rz_identity_ids(v_uid))) THEN
    RETURN v_uid;
  END IF;
  IF public.rz_is_super_admin_for(v_uid) THEN
    PERFORM public.rz_audit_cross(v_uid, NULL, p_company, NULL, 'super_admin_access', 'admin_rpc');
    RETURN v_uid;
  END IF;
  PERFORM public.rz_fail('not_company_admin');
  RETURN v_uid;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_assert_recent_auth()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last bigint;
BEGIN
  BEGIN
    SELECT max((a ->> 'timestamp')::bigint) INTO v_last
    FROM jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a;
  EXCEPTION WHEN OTHERS THEN
    v_last := NULL;
  END;
  IF v_last IS NULL OR to_timestamp(v_last) < now() - interval '10 minutes' THEN
    PERFORM public.rz_fail('reauth_required');
  END IF;
END;
$function$;

-- ---- Âmbito: empresas, grupos, capacidades ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_company_ids_for(p_user uuid, p_cap text)
 RETURNS uuid[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_min integer;
  v_ids uuid[];
BEGIN
  IF p_user IS NULL OR p_cap IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;
  SELECT public.rz_role_rank(c.min_role) INTO v_min
  FROM public.capability_catalog c WHERE c.capability = p_cap;
  IF v_min IS NULL THEN
    RETURN ARRAY[]::uuid[];
  END IF;

  WITH mine AS (
    SELECT cm.company_id, max(public.rz_role_rank(cm.role)) AS r
    FROM public.company_memberships cm
    WHERE cm.user_id = ANY (public.rz_identity_ids(p_user)) AND cm.status = 'ativo'
    GROUP BY cm.company_id
  ),
  own AS (SELECT company_id FROM mine WHERE r >= v_min)
  SELECT coalesce(array_agg(DISTINCT u.company_id), ARRAY[]::uuid[]) INTO v_ids
  FROM (
    -- (a) as minhas empresas, com papel suficiente
    SELECT company_id FROM own
    UNION
    -- (b) empresas que partilharam a capacidade com uma das minhas
    SELECT s.owner_company_id
    FROM public.company_shares s
    WHERE s.status = 'aprovado'
      AND s.capability = p_cap
      AND s.grantee_company_id IN (SELECT company_id FROM own)
    UNION
    -- (c) acesso de suporte vigente, só para platform_admin e só nas capacidades do âmbito
    SELECT g.company_id
    FROM public.support_access_grants g
    WHERE public.rz_is_platform_admin_for(p_user)
      AND g.platform_admin_user_id = p_user
      AND g.revoked_at IS NULL
      AND now() >= g.starts_at AND now() < g.expires_at
      AND p_cap = ANY (g.scope)
    UNION
    -- (d) D14: o super admin usa qualquer capacidade existente em todas as empresas
    SELECT c.id
    FROM public.companies c
    WHERE public.rz_is_super_admin_for(p_user)
  ) u;
  RETURN v_ids;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_company_ids(cap text)
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.rz_company_ids_for(auth.uid(), cap);
$function$;

CREATE OR REPLACE FUNCTION public.rz_my_company_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(DISTINCT cm.company_id), ARRAY[]::uuid[])
  FROM public.company_memberships cm
  WHERE auth.uid() IS NOT NULL
    AND cm.user_id = ANY (public.rz_identity_ids(auth.uid()))
    AND cm.status = 'ativo';
$function$;

CREATE OR REPLACE FUNCTION public.rz_my_group_ids()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(DISTINCT m.group_id), ARRAY[]::uuid[])
  FROM public.company_group_members m
  WHERE m.status = 'ativo'
    AND (m.company_id = ANY (public.rz_my_company_ids()) OR public.rz_is_super_admin());
$function$;

CREATE OR REPLACE FUNCTION public.rz_my_scope(p_cap text)
 RETURNS TABLE(company_id uuid, name text, kind text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_mine   uuid[];
  v_groups uuid[];
BEGIN
  PERFORM public.rz_uid();
  IF NOT EXISTS (SELECT 1 FROM public.capability_catalog WHERE capability = p_cap) THEN
    PERFORM public.rz_fail('unknown_capability');
  END IF;
  v_mine := public.rz_my_company_ids();
  v_groups := public.rz_my_group_ids();
  RETURN QUERY
  SELECT c.id, c.name,
         CASE
           WHEN c.id = ANY (v_mine) THEN 'propria'
           WHEN public.rz_is_super_admin() THEN 'super_admin'
           WHEN EXISTS (SELECT 1 FROM public.company_group_members g
                        WHERE g.company_id = c.id AND g.status = 'ativo' AND g.group_id = ANY (v_groups))
             THEN 'grupo'
           ELSE 'partilha'
         END
  FROM unnest(public.rz_company_ids(p_cap)) AS ids(id)
  JOIN public.companies c ON c.id = ids.id
  ORDER BY c.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_my_companies()
 RETURNS TABLE(company_id uuid, name text, role text, status text, origin text, is_group_member boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT x.company_id, x.name, x.role, x.status, x.origin, x.is_group_member
  FROM (
    SELECT c.id AS company_id, c.name, 'super_admin'::text AS role, 'ativo'::text AS status,
           'super_admin'::text AS origin,
           EXISTS (SELECT 1 FROM public.company_group_members g
                   WHERE g.company_id = c.id AND g.status = 'ativo') AS is_group_member
    FROM public.companies c
    WHERE public.rz_is_super_admin()
    UNION ALL
    SELECT m.company_id, m.name, m.role, m.status, m.origin, m.is_group_member
    FROM (
      SELECT DISTINCT ON (cm.company_id)
             cm.company_id, c.name, cm.role, cm.status, cm.origin,
             EXISTS (SELECT 1 FROM public.company_group_members g
                     WHERE g.company_id = cm.company_id AND g.status = 'ativo') AS is_group_member
      FROM public.company_memberships cm
      JOIN public.companies c ON c.id = cm.company_id
      WHERE auth.uid() IS NOT NULL
        AND cm.user_id = ANY (public.rz_identity_ids(auth.uid()))
        AND cm.status = 'ativo'
      ORDER BY cm.company_id, public.rz_role_rank(cm.role) DESC
    ) m
    WHERE NOT public.rz_is_super_admin()
  ) x
  ORDER BY x.name;
$function$;

CREATE OR REPLACE FUNCTION public.rz_module_on(modulo text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce((SELECT f.enabled FROM public.module_flags f WHERE f.module = modulo), false);
$function$;

CREATE OR REPLACE FUNCTION public.rz_validate_caps(p_caps text[], p_need_grantable boolean DEFAULT true)
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caps text[] := coalesce((SELECT array_agg(DISTINCT c) FROM unnest(p_caps) c WHERE c IS NOT NULL), ARRAY[]::text[]);
  v_cap  text;
  v_ok   boolean;
BEGIN
  FOREACH v_cap IN ARRAY v_caps LOOP
    SELECT grantable INTO v_ok FROM public.capability_catalog WHERE capability = v_cap;
    IF NOT FOUND THEN
      PERFORM public.rz_fail('unknown_capability');
    END IF;
    IF p_need_grantable AND NOT v_ok THEN
      PERFORM public.rz_fail('module_not_grantable');
    END IF;
  END LOOP;
  RETURN v_caps;
END;
$function$;

-- ---- Grupos -----------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_list_groups()
 RETURNS TABLE(group_id uuid, group_name text, group_created_at timestamp with time zone, company_id uuid, company_name text, joined_at timestamp with time zone, origin text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.created_at, c.id, c.name, m.joined_at, m.origin
  FROM public.company_groups g
  JOIN public.company_group_members m ON m.group_id = g.id AND m.status = 'ativo'
  JOIN public.companies c ON c.id = m.company_id
  ORDER BY g.name, c.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_list_group(p_company uuid)
 RETURNS TABLE(group_id uuid, company_id uuid, name text, joined_at timestamp with time zone, origin text, is_me boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_uid();
  IF p_company IS NULL OR NOT (p_company = ANY (public.rz_my_company_ids()) OR public.rz_is_super_admin()) THEN
    PERFORM public.rz_fail('forbidden');
  END IF;
  RETURN QUERY
  SELECT m.group_id, m.company_id, c.name, m.joined_at, m.origin, (m.company_id = p_company)
  FROM public.company_group_members m
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.status = 'ativo'
    AND m.group_id IN (SELECT g.group_id FROM public.company_group_members g
                        WHERE g.company_id = p_company AND g.status = 'ativo')
  ORDER BY m.group_id, c.name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_leave_group(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user   uuid;
  v_groups uuid[];
  v_others uuid[];
  v_n      integer := 0;
  v_row    record;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  SELECT coalesce(array_agg(m.group_id), ARRAY[]::uuid[]) INTO v_groups
    FROM public.company_group_members m WHERE m.company_id = p_company AND m.status = 'ativo';
  IF cardinality(v_groups) = 0 THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  SELECT coalesce(array_agg(DISTINCT m.company_id), ARRAY[]::uuid[]) INTO v_others
    FROM public.company_group_members m
   WHERE m.group_id = ANY (v_groups) AND m.status = 'ativo' AND m.company_id <> p_company;

  FOR v_row IN
    WITH upd AS (
      UPDATE public.company_shares
         SET status = 'revogado', revoked_by = v_user, revoke_reason = 'Saída do grupo'
       WHERE status IN ('pedido', 'aprovado')
         AND ((owner_company_id = p_company AND grantee_company_id = ANY (v_others))
           OR (grantee_company_id = p_company AND owner_company_id = ANY (v_others)))
      RETURNING id, owner_company_id, capability
    )
    SELECT id, owner_company_id, capability FROM upd
  LOOP
    v_n := v_n + 1;
    PERFORM public.rz_audit_cross(v_user, p_company, v_row.owner_company_id, v_row.capability,
                                  'share_revoke', 'company_share', v_row.id, v_row.id);
  END LOOP;

  UPDATE public.company_group_members
     SET status = 'saiu', left_at = now()
   WHERE company_id = p_company AND status = 'ativo';
  -- Um grupo com uma só empresa dissolve-se.
  UPDATE public.company_group_members
     SET status = 'saiu', left_at = now()
   WHERE status = 'ativo' AND group_id = ANY (v_groups)
     AND group_id IN (SELECT m.group_id FROM public.company_group_members m
                       WHERE m.status = 'ativo' AND m.group_id = ANY (v_groups)
                       GROUP BY m.group_id HAVING count(*) < 2);
  RETURN jsonb_build_object('revoked', v_n);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_company_viewers(p_company uuid)
 RETURNS TABLE(user_id uuid, name text, email text, kind text, role text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company) THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT pa.user_id AS uid, 'super_admin'::text AS k, 'super_admin'::text AS r, 1 AS rk
    FROM public.platform_admins pa
    WHERE pa.active
    UNION ALL
    SELECT cm.user_id, CASE cm.role WHEN 'admin' THEN 'admin_empresa' ELSE 'gestor' END,
           cm.role, CASE cm.role WHEN 'admin' THEN 2 ELSE 3 END
    FROM public.company_memberships cm
    WHERE cm.company_id = p_company AND cm.status = 'ativo' AND cm.role IN ('admin', 'gestor')
  ),
  best AS (
    SELECT DISTINCT ON (p.uid) p.uid, p.k, p.r, p.rk
    FROM people p ORDER BY p.uid, p.rk
  )
  SELECT b.uid,
         coalesce(nullif(trim(e.ename), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                  split_part(u.email::text, '@', 1)) AS vname,
         u.email::text, b.k, b.r
  FROM best b
  JOIN auth.users u ON u.id = b.uid
  LEFT JOIN LATERAL (
    SELECT emp.name AS ename FROM public.employees emp
    WHERE emp.user_id = b.uid AND emp.is_active ORDER BY emp.name LIMIT 1
  ) e ON true
  ORDER BY b.rk, vname;
END;
$function$;

-- ---- Códigos de partilha, pedidos e partilhas (fora de âmbito: reproduzido como está) ---------
CREATE OR REPLACE FUNCTION public.rz_get_share_code(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.company_share_codes%ROWTYPE;
  i integer;
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  SELECT * INTO v_row FROM public.company_share_codes WHERE company_id = p_company;
  IF NOT FOUND THEN
    FOR i IN 1..5 LOOP
      BEGIN
        INSERT INTO public.company_share_codes (company_id, share_code)
        VALUES (p_company, public.rz_gen_share_code())
        RETURNING * INTO v_row;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        SELECT * INTO v_row FROM public.company_share_codes WHERE company_id = p_company;
        EXIT WHEN FOUND;  -- outro pedido criou-o entre as duas leituras
      END;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('share_code', v_row.share_code, 'rotated_at', v_row.rotated_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_rotate_share_code(p_company uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row public.company_share_codes%ROWTYPE;
  i integer;
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  FOR i IN 1..5 LOOP
    BEGIN
      INSERT INTO public.company_share_codes AS sc (company_id, share_code, rotated_at)
      VALUES (p_company, public.rz_gen_share_code(), now())
      ON CONFLICT (company_id) DO UPDATE SET share_code = EXCLUDED.share_code, rotated_at = now()
      RETURNING sc.* INTO v_row;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      NULL;  -- código repetido noutra empresa (muito improvável): tenta outro
    END;
  END LOOP;
  IF v_row.company_id IS NULL THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  RETURN jsonb_build_object('share_code', v_row.share_code, 'rotated_at', v_row.rotated_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_request_share(p_company uuid, p_code text, p_proposed jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user   uuid;
  v_ip     inet := public.rz_request_ip();
  v_code   text;
  v_ask    text[];
  v_offer  text[];
  v_target uuid;
  v_req    uuid;
  v_n      integer;
  v_cap    text;
  v_neutral constant jsonb := jsonb_build_object('submitted', true);
BEGIN
  v_user := public.rz_assert_admin(p_company);

  IF p_proposed IS NULL OR jsonb_typeof(p_proposed) <> 'object'
     OR (p_proposed ? 'ask' AND jsonb_typeof(p_proposed -> 'ask') <> 'array')
     OR (p_proposed ? 'offer' AND jsonb_typeof(p_proposed -> 'offer') <> 'array') THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  v_ask   := public.rz_validate_caps(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_proposed -> 'ask', '[]'::jsonb))));
  v_offer := public.rz_validate_caps(ARRAY(SELECT jsonb_array_elements_text(coalesce(p_proposed -> 'offer', '[]'::jsonb))));
  IF cardinality(v_ask) + cardinality(v_offer) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o que pede ou o que oferece.');
  END IF;
  -- O que a empresa A oferece é dela: capacidades sensíveis pedem reautenticação recente.
  IF EXISTS (SELECT 1 FROM public.capability_catalog c WHERE c.capability = ANY (v_offer) AND c.sensitive) THEN
    PERFORM public.rz_assert_recent_auth();
  END IF;

  -- Limite: 5 tentativas por hora, por empresa e por IP. A partir daqui nada levanta erro.
  SELECT count(*) INTO v_n
  FROM public.share_request_attempts a
  WHERE a.at > now() - interval '1 hour'
    AND (a.company_id = p_company OR (v_ip IS NOT NULL AND a.ip = v_ip));
  IF v_n >= 5 THEN
    PERFORM public.rz_fail('rate_limited');
  END IF;
  INSERT INTO public.share_request_attempts (company_id, ip) VALUES (p_company, v_ip);

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  IF length(v_code) <> 10 THEN
    RETURN v_neutral;
  END IF;

  SELECT sc.company_id INTO v_target
  FROM public.company_share_codes sc
  JOIN public.companies c ON c.id = sc.company_id
  WHERE sc.share_code = v_code AND c.status = 'ativa';
  IF v_target IS NULL OR v_target = p_company THEN
    RETURN v_neutral;
  END IF;

  INSERT INTO public.company_join_requests (requester_company_id, target_company_id, requested_by, proposed)
  VALUES (p_company, v_target, v_user,
          jsonb_build_object('ask', to_jsonb(v_ask), 'offer', to_jsonb(v_offer)))
  ON CONFLICT (requester_company_id, target_company_id) WHERE status = 'pedido' DO NOTHING
  RETURNING id INTO v_req;
  IF v_req IS NULL THEN
    RETURN v_neutral;  -- já há um pedido pendente entre as duas
  END IF;

  -- O que A oferece fica já aprovado pelo seu admin (o pedido vale como aprovação de A) e passa a
  -- ativo quando a empresa B aprovar.
  FOREACH v_cap IN ARRAY v_offer LOOP
    INSERT INTO public.company_shares
      (owner_company_id, grantee_company_id, capability, status, origin, request_id, approved_by)
    VALUES (p_company, v_target, v_cap, 'pedido', 'pedido', v_req, v_user)
    ON CONFLICT (owner_company_id, grantee_company_id, capability) WHERE status IN ('pedido','aprovado')
      DO NOTHING;
  END LOOP;

  PERFORM public.rz_audit_cross(v_user, p_company, v_target, NULL, 'share_request', 'join_request', v_req);
  RETURN v_neutral;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_approve_share(p_request uuid, p_grant text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid := public.rz_uid();
  v_r       public.company_join_requests%ROWTYPE;
  v_grant   text[];
  v_offers  integer;
  v_ids     uuid[] := ARRAY[]::uuid[];
  v_cap     text;
  v_sid     uuid;
  v_group   uuid;
  v_name    text;
  v_row     record;
BEGIN
  SELECT * INTO v_r FROM public.company_join_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF NOT public.rz_is_company_admin_for(v_user, v_r.target_company_id) THEN
    PERFORM public.rz_fail('not_found');
  END IF;

  -- Repetir a aprovação devolve o mesmo resultado, sem duplicar.
  IF v_r.status = 'aprovado' THEN
    SELECT a.group_id INTO v_group
    FROM public.company_group_members a
    JOIN public.company_group_members b ON b.group_id = a.group_id
    WHERE a.company_id = v_r.target_company_id AND b.company_id = v_r.requester_company_id
      AND a.status = 'ativo' AND b.status = 'ativo'
    LIMIT 1;
    SELECT coalesce(array_agg(s.id), ARRAY[]::uuid[]) INTO v_ids
    FROM public.company_shares s WHERE s.request_id = p_request AND s.status = 'aprovado';
    RETURN jsonb_build_object('status', 'aprovado', 'group_id', v_group, 'share_ids', to_jsonb(v_ids));
  END IF;
  IF v_r.status <> 'pedido' THEN
    PERFORM public.rz_fail('request_not_pending');
  END IF;
  IF v_r.expires_at < now() THEN
    PERFORM public.rz_fail('request_expired');
  END IF;

  v_grant := public.rz_validate_caps(p_grant);
  SELECT count(*) INTO v_offers FROM public.company_shares
   WHERE request_id = p_request AND owner_company_id = v_r.requester_company_id AND status = 'pedido';
  IF cardinality(v_grant) + v_offers = 0 THEN
    PERFORM public.rz_fail('nothing_to_grant');
  END IF;
  IF EXISTS (SELECT 1 FROM public.capability_catalog c WHERE c.capability = ANY (v_grant) AND c.sensitive) THEN
    PERFORM public.rz_assert_recent_auth();
  END IF;

  -- O que a empresa dona (B) concede à A.
  FOREACH v_cap IN ARRAY v_grant LOOP
    v_sid := NULL;
    UPDATE public.company_shares
       SET status = 'aprovado', approved_by = v_user, approved_at = now(), request_id = coalesce(request_id, p_request)
     WHERE owner_company_id = v_r.target_company_id AND grantee_company_id = v_r.requester_company_id
       AND capability = v_cap AND status = 'pedido'
    RETURNING id INTO v_sid;
    IF v_sid IS NULL THEN
      SELECT s.id INTO v_sid FROM public.company_shares s
       WHERE s.owner_company_id = v_r.target_company_id AND s.grantee_company_id = v_r.requester_company_id
         AND s.capability = v_cap AND s.status = 'aprovado';
    END IF;
    IF v_sid IS NULL THEN
      INSERT INTO public.company_shares
        (owner_company_id, grantee_company_id, capability, status, origin, request_id, approved_by, approved_at)
      VALUES (v_r.target_company_id, v_r.requester_company_id, v_cap, 'aprovado', 'pedido', p_request, v_user, now())
      RETURNING id INTO v_sid;
    END IF;
    v_ids := v_ids || v_sid;
    PERFORM public.rz_audit_cross(v_user, v_r.target_company_id, v_r.target_company_id, v_cap,
                                  'share_approve', 'company_share', v_sid, v_sid);
  END LOOP;

  -- O que a empresa A ofereceu no pedido passa a ativo (A aprovou-o ao pedir).
  FOR v_row IN
    WITH upd AS (
      UPDATE public.company_shares
         SET status = 'aprovado', approved_at = v_r.created_at
       WHERE request_id = p_request AND owner_company_id = v_r.requester_company_id AND status = 'pedido'
      RETURNING id, capability
    )
    SELECT id, capability FROM upd
  LOOP
    v_ids := v_ids || v_row.id;
    PERFORM public.rz_audit_cross(v_r.requested_by, v_r.requester_company_id, v_r.requester_company_id,
                                  v_row.capability, 'share_approve', 'company_share', v_row.id, v_row.id);
  END LOOP;

  -- Grupo: se já partilham um grupo, nada a fazer; senão a A entra no da B, ou a B no da A, ou cria-se um.
  SELECT a.group_id INTO v_group
  FROM public.company_group_members a
  JOIN public.company_group_members b ON b.group_id = a.group_id
  WHERE a.company_id = v_r.target_company_id AND b.company_id = v_r.requester_company_id
    AND a.status = 'ativo' AND b.status = 'ativo'
  LIMIT 1;
  IF v_group IS NULL THEN
    SELECT g.group_id INTO v_group FROM public.company_group_members g
     WHERE g.company_id = v_r.target_company_id AND g.status = 'ativo' ORDER BY g.joined_at LIMIT 1;
    IF v_group IS NOT NULL THEN
      INSERT INTO public.company_group_members (group_id, company_id, origin)
      VALUES (v_group, v_r.requester_company_id, 'pedido')
      ON CONFLICT (group_id, company_id) DO UPDATE SET status = 'ativo', left_at = NULL, joined_at = now();
    ELSE
      SELECT g.group_id INTO v_group FROM public.company_group_members g
       WHERE g.company_id = v_r.requester_company_id AND g.status = 'ativo' ORDER BY g.joined_at LIMIT 1;
      IF v_group IS NOT NULL THEN
        INSERT INTO public.company_group_members (group_id, company_id, origin)
        VALUES (v_group, v_r.target_company_id, 'pedido')
        ON CONFLICT (group_id, company_id) DO UPDATE SET status = 'ativo', left_at = NULL, joined_at = now();
      ELSE
        SELECT c.name INTO v_name FROM public.companies c WHERE c.id = v_r.target_company_id;
        INSERT INTO public.company_groups (name, created_by_company_id)
        VALUES ('Grupo ' || coalesce(v_name, ''), v_r.target_company_id)
        RETURNING id INTO v_group;
        INSERT INTO public.company_group_members (group_id, company_id, origin)
        VALUES (v_group, v_r.target_company_id, 'pedido'), (v_group, v_r.requester_company_id, 'pedido');
      END IF;
    END IF;
  END IF;

  UPDATE public.company_join_requests
     SET status = 'aprovado', decided_by = v_user, decided_at = now()
   WHERE id = p_request;
  RETURN jsonb_build_object('status', 'aprovado', 'group_id', v_group, 'share_ids', to_jsonb(v_ids));
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_cancel_request(p_request uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := public.rz_uid();
  v_r    public.company_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.company_join_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF NOT public.rz_is_company_admin_for(v_user, v_r.requester_company_id) THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF v_r.status <> 'pedido' THEN
    PERFORM public.rz_fail('request_not_pending');
  END IF;

  UPDATE public.company_join_requests
     SET status = 'cancelado', decided_by = v_user, decided_at = now()
   WHERE id = p_request;
  UPDATE public.company_shares
     SET status = 'revogado', revoked_by = v_user, revoke_reason = 'Pedido cancelado'
   WHERE request_id = p_request AND status = 'pedido';
  PERFORM public.rz_audit_cross(v_user, v_r.requester_company_id, v_r.target_company_id, NULL,
                                'share_revoke', 'join_request', p_request);
  RETURN jsonb_build_object('status', 'cancelado');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_reject_request(p_request uuid, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := public.rz_uid();
  v_r    public.company_join_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_r FROM public.company_join_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF NOT public.rz_is_company_admin_for(v_user, v_r.target_company_id) THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF v_r.status <> 'pedido' THEN
    PERFORM public.rz_fail('request_not_pending');
  END IF;

  UPDATE public.company_join_requests
     SET status = 'recusado', decided_by = v_user, decided_at = now(), decision_note = left(p_note, 500)
   WHERE id = p_request;
  UPDATE public.company_shares
     SET status = 'revogado', revoked_by = v_user, revoke_reason = 'Pedido recusado'
   WHERE request_id = p_request AND status = 'pedido';
  PERFORM public.rz_audit_cross(v_user, v_r.target_company_id, v_r.target_company_id, NULL,
                                'share_revoke', 'join_request', p_request);
  RETURN jsonb_build_object('status', 'recusado');
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_confirm_legacy_share(p_company uuid, p_share uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user      uuid;
  v_s         public.company_shares%ROWTYPE;
  v_confirmed timestamptz;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  SELECT * INTO v_s FROM public.company_shares WHERE id = p_share FOR UPDATE;
  IF NOT FOUND OR v_s.owner_company_id <> p_company OR v_s.origin <> 'legado' THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF v_s.status <> 'aprovado' THEN
    PERFORM public.rz_fail('share_not_active');
  END IF;
  UPDATE public.company_shares SET legacy_confirmed_at = coalesce(legacy_confirmed_at, now())
   WHERE id = p_share RETURNING legacy_confirmed_at INTO v_confirmed;
  PERFORM public.rz_audit_cross(v_user, p_company, p_company, v_s.capability,
                                'share_approve', 'company_share', p_share, p_share);
  RETURN jsonb_build_object('legacy_confirmed_at', v_confirmed);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_expire_requests()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids uuid[];
BEGIN
  WITH e AS (
    UPDATE public.company_join_requests
       SET status = 'expirado', decided_at = now()
     WHERE status = 'pedido' AND expires_at < now()
    RETURNING id
  )
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids FROM e;
  UPDATE public.company_shares
     SET status = 'revogado', revoke_reason = 'Pedido expirado'
   WHERE request_id = ANY (v_ids) AND status = 'pedido';
  RETURN cardinality(v_ids);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_list_requests(p_company uuid, p_direction text)
 RETURNS TABLE(request_id uuid, status text, created_at timestamp with time zone, expires_at timestamp with time zone, other_company_id uuid, other_company_name text, ask text[], offer text[], decided_at timestamp with time zone, decision_note text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  IF p_direction NOT IN ('received', 'sent') THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  RETURN QUERY
  SELECT x.id, x.eff, x.created_at, x.expires_at,
         CASE WHEN p_direction = 'received' OR x.eff = 'aprovado' THEN x.other_id END,
         CASE WHEN p_direction = 'received' OR x.eff = 'aprovado' THEN c.name END,
         ARRAY(SELECT jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(x.proposed -> 'ask') = 'array' THEN x.proposed -> 'ask' ELSE '[]'::jsonb END)),
         ARRAY(SELECT jsonb_array_elements_text(
                 CASE WHEN jsonb_typeof(x.proposed -> 'offer') = 'array' THEN x.proposed -> 'offer' ELSE '[]'::jsonb END)),
         x.decided_at, x.decision_note
  FROM (
    SELECT r.id, r.created_at, r.expires_at, r.proposed, r.decided_at, r.decision_note,
           CASE WHEN r.status = 'pedido' AND r.expires_at < now() THEN 'expirado' ELSE r.status END AS eff,
           CASE WHEN p_direction = 'received' THEN r.requester_company_id ELSE r.target_company_id END AS other_id
    FROM public.company_join_requests r
    WHERE (p_direction = 'received' AND r.target_company_id = p_company)
       OR (p_direction = 'sent' AND r.requester_company_id = p_company)
  ) x
  JOIN public.companies c ON c.id = x.other_id
  ORDER BY x.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_list_shares(p_company uuid, p_include_revoked boolean DEFAULT false)
 RETURNS TABLE(share_id uuid, direction text, other_company_id uuid, other_company_name text, capability text, capability_description text, sensitive boolean, status text, origin text, approved_at timestamp with time zone, legacy_confirmed_at timestamp with time zone, legacy_due_at timestamp with time zone, revoked_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  PERFORM public.rz_assert_admin(p_company);
  RETURN QUERY
  SELECT s.id,
         CASE WHEN s.owner_company_id = p_company THEN 'dada' ELSE 'recebida' END,
         CASE WHEN hide.h THEN NULL ELSE o.id END,
         CASE WHEN hide.h THEN NULL ELSE o.name END,
         s.capability, k.description, k.sensitive, s.status, s.origin,
         s.approved_at, s.legacy_confirmed_at, s.legacy_due_at, s.revoked_at
  FROM public.company_shares s
  JOIN public.capability_catalog k ON k.capability = s.capability
  JOIN public.companies o
    ON o.id = CASE WHEN s.owner_company_id = p_company THEN s.grantee_company_id ELSE s.owner_company_id END
  LEFT JOIN public.company_join_requests r ON r.id = s.request_id
  CROSS JOIN LATERAL (
    SELECT (s.status = 'pedido' AND r.requester_company_id = p_company) AS h
  ) hide
  WHERE (s.owner_company_id = p_company OR s.grantee_company_id = p_company)
    AND (s.status IN ('pedido', 'aprovado') OR p_include_revoked)
  ORDER BY o.name, s.capability;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_set_shares(p_company uuid, p_other uuid, p_capabilities text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid;
  v_want    text[];
  v_have    text[];
  v_add     text[];
  v_remove  text[];
  v_req     uuid;
  v_cap     text;
  v_sid     uuid;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  IF p_other IS NULL OR p_other = p_company THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;

  -- Só entre empresas já ligadas (pedido aprovado, partilha existente ou grupo em comum).
  SELECT r.id INTO v_req FROM public.company_join_requests r
   WHERE r.status = 'aprovado'
     AND ((r.requester_company_id = p_company AND r.target_company_id = p_other)
       OR (r.requester_company_id = p_other AND r.target_company_id = p_company))
   ORDER BY r.decided_at DESC LIMIT 1;
  IF v_req IS NULL AND NOT EXISTS (
       SELECT 1 FROM public.company_shares s
        WHERE (s.owner_company_id = p_company AND s.grantee_company_id = p_other)
           OR (s.owner_company_id = p_other AND s.grantee_company_id = p_company))
     AND NOT EXISTS (
       SELECT 1 FROM public.company_group_members a
       JOIN public.company_group_members b ON b.group_id = a.group_id
        WHERE a.company_id = p_company AND b.company_id = p_other AND a.status = 'ativo' AND b.status = 'ativo') THEN
    PERFORM public.rz_fail('not_found');
  END IF;

  v_want := public.rz_validate_caps(p_capabilities);
  SELECT coalesce(array_agg(s.capability), ARRAY[]::text[]) INTO v_have
    FROM public.company_shares s
   WHERE s.owner_company_id = p_company AND s.grantee_company_id = p_other AND s.status = 'aprovado';
  v_add := ARRAY(SELECT unnest(v_want) EXCEPT SELECT unnest(v_have));
  v_remove := ARRAY(SELECT unnest(v_have) EXCEPT SELECT unnest(v_want));

  IF EXISTS (SELECT 1 FROM public.capability_catalog c WHERE c.capability = ANY (v_add) AND c.sensitive) THEN
    PERFORM public.rz_assert_recent_auth();
  END IF;

  FOREACH v_cap IN ARRAY v_add LOOP
    v_sid := NULL;
    UPDATE public.company_shares
       SET status = 'aprovado', approved_by = v_user, approved_at = now()
     WHERE owner_company_id = p_company AND grantee_company_id = p_other AND capability = v_cap AND status = 'pedido'
    RETURNING id INTO v_sid;
    IF v_sid IS NULL THEN
      INSERT INTO public.company_shares
        (owner_company_id, grantee_company_id, capability, status, origin, request_id, approved_by, approved_at)
      VALUES (p_company, p_other, v_cap, 'aprovado', 'pedido', v_req, v_user, now())
      RETURNING id INTO v_sid;
    END IF;
    PERFORM public.rz_audit_cross(v_user, p_company, p_company, v_cap, 'share_approve', 'company_share', v_sid, v_sid);
  END LOOP;

  FOREACH v_cap IN ARRAY v_remove LOOP
    UPDATE public.company_shares
       SET status = 'revogado', revoked_by = v_user, revoke_reason = 'Alterado pela empresa dona'
     WHERE owner_company_id = p_company AND grantee_company_id = p_other AND capability = v_cap AND status = 'aprovado'
    RETURNING id INTO v_sid;
    PERFORM public.rz_audit_cross(v_user, p_company, p_company, v_cap, 'share_revoke', 'company_share', v_sid, v_sid);
  END LOOP;

  RETURN jsonb_build_object('added', to_jsonb(v_add), 'removed', to_jsonb(v_remove));
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_revoke_share(p_company uuid, p_share uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
  v_s    public.company_shares%ROWTYPE;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  SELECT * INTO v_s FROM public.company_shares WHERE id = p_share FOR UPDATE;
  IF NOT FOUND OR (v_s.owner_company_id <> p_company AND v_s.grantee_company_id <> p_company) THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  IF v_s.status NOT IN ('pedido', 'aprovado') THEN
    PERFORM public.rz_fail('share_not_active');
  END IF;
  UPDATE public.company_shares
     SET status = 'revogado', revoked_by = v_user, revoke_reason = left(p_reason, 500)
   WHERE id = p_share;
  PERFORM public.rz_audit_cross(v_user, p_company, v_s.owner_company_id, v_s.capability,
                                'share_revoke', 'company_share', p_share, p_share);
  RETURN jsonb_build_object('status', 'revogado');
END;
$function$;

-- ---- Acesso de suporte ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rz_grant_support_access(p_company uuid, p_platform_admin uuid, p_scope text[], p_reason text, p_hours integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user  uuid;
  v_scope text[];
  v_id    uuid;
  v_exp   timestamptz;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    PERFORM public.rz_fail('reason_required');
  END IF;
  IF p_hours IS NULL OR p_hours < 1 OR p_hours > 24 THEN
    PERFORM public.rz_fail('duration_too_long');
  END IF;
  IF p_platform_admin IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = p_platform_admin AND pa.active) THEN
    PERFORM public.rz_fail('invalid_argument', 'Escolha um administrador da plataforma válido.');
  END IF;
  v_scope := public.rz_validate_caps(p_scope, false);
  IF cardinality(v_scope) = 0 THEN
    PERFORM public.rz_fail('invalid_argument', 'Indique o que o suporte pode ver.');
  END IF;

  v_exp := now() + make_interval(hours => p_hours);
  INSERT INTO public.support_access_grants
    (company_id, platform_admin_user_id, granted_by, scope, reason, expires_at)
  VALUES (p_company, p_platform_admin, v_user, v_scope, left(trim(p_reason), 500), v_exp)
  RETURNING id INTO v_id;
  PERFORM public.rz_audit_cross(v_user, p_company, p_company, NULL, 'support_grant',
                                'support_access_grant', NULL, NULL, v_id);
  RETURN jsonb_build_object('grant_id', v_id, 'expires_at', v_exp);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_revoke_support_access(p_company uuid, p_grant uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid;
  v_n    integer;
BEGIN
  v_user := public.rz_assert_admin(p_company);
  UPDATE public.support_access_grants
     SET revoked_at = now()
   WHERE id = p_grant AND company_id = p_company AND revoked_at IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    PERFORM public.rz_fail('not_found');
  END IF;
  PERFORM public.rz_audit_cross(v_user, p_company, p_company, NULL, 'support_revoke',
                                'support_access_grant', NULL, NULL, p_grant);
  RETURN jsonb_build_object('status', 'revogado');
END;
$function$;

-- ---- Interruptores de módulos e segundo fator dos super admins ---------------------------------
CREATE OR REPLACE FUNCTION public.rz_set_module_flag(p_module text, p_enabled boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := public.rz_uid();
  v_at   timestamptz;
BEGIN
  IF NOT public.rz_is_platform_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  IF p_enabled IS NULL THEN
    PERFORM public.rz_fail('invalid_argument');
  END IF;
  UPDATE public.module_flags
     SET enabled = p_enabled, changed_by = v_user, changed_at = now(), note = left(p_note, 500)
   WHERE module = p_module
  RETURNING changed_at INTO v_at;
  IF v_at IS NULL THEN
    PERFORM public.rz_fail('invalid_argument', 'Módulo desconhecido.');
  END IF;
  PERFORM public.rz_audit_cross(v_user, NULL, NULL, p_module, 'flag_change', 'module_flag');
  RETURN jsonb_build_object('module', p_module, 'enabled', p_enabled, 'changed_at', v_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_enable_super_admin_mfa()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_missing uuid[];
  v_total   integer;
BEGIN
  SELECT count(*) INTO v_total FROM public.platform_admins pa WHERE pa.active;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'mfa_no_super_admins' USING ERRCODE = '55000', DETAIL = 'Não há contas Super Admin ativas.';
  END IF;
  SELECT coalesce(array_agg(pa.user_id), ARRAY[]::uuid[]) INTO v_missing
  FROM public.platform_admins pa
  WHERE pa.active
    AND NOT EXISTS (
      SELECT 1 FROM auth.mfa_factors f
      WHERE f.factor_type = 'totp' AND f.status = 'verified'
        AND (f.user_id = pa.user_id OR pa.user_id = ANY (public.rz_identity_ids(f.user_id))));
  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'mfa_not_all_enrolled'
      USING ERRCODE = '55000',
            DETAIL = format('Faltam %s de %s contas com TOTP: %s', cardinality(v_missing), v_total, v_missing::text);
  END IF;
  UPDATE public.platform_admins SET mfa_required = true WHERE active AND NOT mfa_required;
  RETURN jsonb_build_object('super_admins', v_total, 'mfa_required', true);
END;
$function$;

-- ============================================================================================
-- 6. Partições da auditoria (por omissão + meses a partir de hoje)
-- ============================================================================================
-- Só cria a partição por omissão se a tabela ainda não tiver nenhuma (qualquer nome).
DO $default_part$
BEGIN
  IF (SELECT partdefid FROM pg_partitioned_table
       WHERE partrelid = 'public.cross_company_audit'::regclass) = 0 THEN
    CREATE TABLE public.cross_company_audit_default
      PARTITION OF public.cross_company_audit DEFAULT;
    ALTER TABLE public.cross_company_audit_default ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON TABLE public.cross_company_audit_default FROM PUBLIC, anon, authenticated;
  END IF;
END
$default_part$;

-- Sequências: sem acesso para anon/authenticated (as funções SECURITY DEFINER inserem por eles).
REVOKE ALL ON SEQUENCE public.cross_company_audit_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.cross_company_audit_id_seq TO service_role;
DO $seq_acl$
DECLARE
  v_seq text := pg_get_serial_sequence('public.share_request_attempts', 'id');
BEGIN
  IF v_seq IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', v_seq);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', v_seq);
  END IF;
END
$seq_acl$;

-- Cria o mês corrente e os três seguintes (a tarefa mensal renova-os). Em falha só avisa.
SELECT public.rz_audit_ensure_partitions();

-- ============================================================================================
-- 7. Gatilhos
-- ============================================================================================
DROP TRIGGER IF EXISTS company_memberships_guard ON public.company_memberships;
CREATE TRIGGER company_memberships_guard
  BEFORE UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.rz_membership_guard();

DROP TRIGGER IF EXISTS company_shares_guard ON public.company_shares;
CREATE TRIGGER company_shares_guard
  BEFORE INSERT OR UPDATE ON public.company_shares
  FOR EACH ROW EXECUTE FUNCTION public.rz_share_guard();

DROP TRIGGER IF EXISTS cross_company_audit_immutable ON public.cross_company_audit;
CREATE TRIGGER cross_company_audit_immutable
  BEFORE DELETE OR UPDATE ON public.cross_company_audit
  FOR EACH ROW EXECUTE FUNCTION public.rz_audit_immutable();

DROP TRIGGER IF EXISTS company_memberships_touch ON public.company_memberships;
CREATE TRIGGER company_memberships_touch
  BEFORE UPDATE ON public.company_memberships
  FOR EACH ROW EXECUTE FUNCTION public.rz_touch_updated_at();

DROP TRIGGER IF EXISTS company_shares_touch ON public.company_shares;
CREATE TRIGGER company_shares_touch
  BEFORE UPDATE ON public.company_shares
  FOR EACH ROW EXECUTE FUNCTION public.rz_touch_updated_at();

-- ============================================================================================
-- 8. Row Level Security (11 tabelas da camada + module_flags)
-- ============================================================================================
ALTER TABLE public.capability_catalog      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_group_members   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_join_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_memberships     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_share_codes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_shares          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_company_audit     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.share_request_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_access_grants   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_flags            ENABLE ROW LEVEL SECURITY;

-- ============================================================================================
-- 9. Políticas (só leitura; escrita só pelo servidor e pelas funções SECURITY DEFINER)
--    company_share_codes, platform_admins e share_request_attempts não têm políticas.
-- ============================================================================================
DROP POLICY IF EXISTS "Catálogo: leitura para quem tem sessão" ON public.capability_catalog;
CREATE POLICY "Catálogo: leitura para quem tem sessão" ON public.capability_catalog
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Leitura: membros dos grupos da minha empresa" ON public.company_group_members;
CREATE POLICY "Leitura: membros dos grupos da minha empresa" ON public.company_group_members
  FOR SELECT TO authenticated USING (group_id = ANY ((SELECT public.rz_my_group_ids())::uuid[]));

DROP POLICY IF EXISTS "Leitura: grupos da minha empresa" ON public.company_groups;
CREATE POLICY "Leitura: grupos da minha empresa" ON public.company_groups
  FOR SELECT TO authenticated USING (id = ANY ((SELECT public.rz_my_group_ids())::uuid[]));

DROP POLICY IF EXISTS "Leitura: pedidos da minha empresa (admin)" ON public.company_join_requests;
CREATE POLICY "Leitura: pedidos da minha empresa (admin)" ON public.company_join_requests
  FOR SELECT TO authenticated USING (public.rz_is_company_admin(requester_company_id) OR public.rz_is_company_admin(target_company_id));

DROP POLICY IF EXISTS "Leitura: pertenças da minha empresa (admin)" ON public.company_memberships;
CREATE POLICY "Leitura: pertenças da minha empresa (admin)" ON public.company_memberships
  FOR SELECT TO authenticated USING (public.rz_is_company_admin(company_id));

DROP POLICY IF EXISTS "Pertenças: as minhas" ON public.company_memberships;
CREATE POLICY "Pertenças: as minhas" ON public.company_memberships
  FOR SELECT TO authenticated USING (user_id = ANY ((SELECT public.rz_identity_ids((SELECT auth.uid())))::uuid[]));

DROP POLICY IF EXISTS "Leitura: partilhas da minha empresa (admin)" ON public.company_shares;
CREATE POLICY "Leitura: partilhas da minha empresa (admin)" ON public.company_shares
  FOR SELECT TO authenticated USING (public.rz_is_company_admin(owner_company_id) OR public.rz_is_company_admin(grantee_company_id));

DROP POLICY IF EXISTS "Leitura: auditoria completa (super_admin)" ON public.cross_company_audit;
CREATE POLICY "Leitura: auditoria completa (super_admin)" ON public.cross_company_audit
  FOR SELECT TO authenticated USING (public.rz_is_super_admin());

DROP POLICY IF EXISTS "Leitura: auditoria da minha empresa (admin dona)" ON public.cross_company_audit;
CREATE POLICY "Leitura: auditoria da minha empresa (admin dona)" ON public.cross_company_audit
  FOR SELECT TO authenticated USING (public.rz_is_company_admin(owner_company_id));

DROP POLICY IF EXISTS "Leitura: mudanças de interruptores (platform_admin)" ON public.cross_company_audit;
CREATE POLICY "Leitura: mudanças de interruptores (platform_admin)" ON public.cross_company_audit
  FOR SELECT TO authenticated USING ((action = 'flag_change'::text) AND public.rz_is_platform_admin());

DROP POLICY IF EXISTS "Leitura: acessos de suporte da minha empresa (admin)" ON public.support_access_grants;
CREATE POLICY "Leitura: acessos de suporte da minha empresa (admin)" ON public.support_access_grants
  FOR SELECT TO authenticated USING (public.rz_is_company_admin(company_id));

DROP POLICY IF EXISTS "Interruptores: leitura para quem tem sessão" ON public.module_flags;
CREATE POLICY "Interruptores: leitura para quem tem sessão" ON public.module_flags
  FOR SELECT TO authenticated USING (true);

-- ============================================================================================
-- 10. Permissões de tabela: anon e PUBLIC nunca; authenticated só SELECT, e só onde a app lê;
--     service_role tudo. platform_admins, company_share_codes e share_request_attempts: só servidor.
-- ============================================================================================
REVOKE ALL ON TABLE
  public.capability_catalog, public.company_group_members, public.company_groups,
  public.company_join_requests, public.company_memberships, public.company_share_codes,
  public.company_shares, public.cross_company_audit, public.platform_admins,
  public.share_request_attempts, public.support_access_grants, public.module_flags
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.capability_catalog, public.company_group_members, public.company_groups,
  public.company_join_requests, public.company_memberships, public.company_shares,
  public.cross_company_audit, public.module_flags, public.support_access_grants
  TO authenticated;

GRANT DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE
  public.capability_catalog, public.company_group_members, public.company_groups,
  public.company_join_requests, public.company_memberships, public.company_share_codes,
  public.company_shares, public.cross_company_audit, public.platform_admins,
  public.share_request_attempts, public.support_access_grants, public.module_flags
  TO service_role;

-- ============================================================================================
-- 11. Permissões de funções (ACL da base real)
--     Internas: só service_role. Usadas pela app: authenticated + service_role. Nunca anon.
-- ============================================================================================
DO $acl$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'rz_assert_admin(uuid)', 'rz_assert_recent_auth()',
    'rz_audit_cross(uuid, uuid, uuid, text, text, text, uuid, uuid, uuid, text)',
    'rz_audit_ensure_partitions()', 'rz_audit_immutable()',
    'rz_company_ids_for(uuid, text)', 'rz_enable_super_admin_mfa()', 'rz_expire_requests()',
    'rz_fail(text, text)', 'rz_gen_share_code()', 'rz_is_company_admin_for(uuid, uuid)',
    'rz_is_platform_admin_for(uuid)', 'rz_is_super_admin_for(uuid)', 'rz_membership_guard()',
    'rz_request_ip()', 'rz_share_guard()', 'rz_sync_membership()', 'rz_touch_updated_at()', 'rz_uid()',
    'rz_validate_caps(text[], boolean)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', s);
  END LOOP;

  FOREACH s IN ARRAY ARRAY[
    'rz_approve_share(uuid, text[])', 'rz_cancel_request(uuid)', 'rz_company_ids(text)',
    'rz_company_viewers(uuid)', 'rz_confirm_legacy_share(uuid, uuid)', 'rz_get_share_code(uuid)',
    'rz_grant_support_access(uuid, uuid, text[], text, integer)', 'rz_is_company_admin(uuid)',
    'rz_is_platform_admin()', 'rz_is_super_admin()', 'rz_leave_group(uuid)', 'rz_list_group(uuid)',
    'rz_list_groups()', 'rz_list_requests(uuid, text)', 'rz_list_shares(uuid, boolean)',
    'rz_module_on(text)', 'rz_my_companies()', 'rz_my_company_ids()', 'rz_my_group_ids()',
    'rz_my_scope(text)', 'rz_reject_request(uuid, text)', 'rz_request_share(uuid, text, jsonb)',
    'rz_revoke_share(uuid, uuid, text)', 'rz_revoke_support_access(uuid, uuid)', 'rz_role_rank(text)', 'rz_rotate_share_code(uuid)',
    'rz_set_module_flag(text, boolean, text)', 'rz_set_shares(uuid, uuid, text[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', s);
  END LOOP;
END
$acl$;

-- ============================================================================================
-- 12. Tarefas agendadas (só se ainda não existirem)
-- ============================================================================================
DO $cron$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE WARNING 'pg_cron não está ativo: tarefas rz-audit-partitions e rz-expire-requests não criadas';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rz-audit-partitions') THEN
    PERFORM cron.schedule('rz-audit-partitions', '0 3 1 * *', 'SELECT public.rz_audit_ensure_partitions()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rz-expire-requests') THEN
    PERFORM cron.schedule('rz-expire-requests', '30 3 * * *', 'SELECT public.rz_expire_requests()');
  END IF;
END
$cron$;

-- ============================================================================================
-- 13. Dados de arranque (só catálogo e interruptores; nenhum dado de produção)
-- ============================================================================================
INSERT INTO public.capability_catalog (capability, module, kind, grantable, sensitive, min_role, description) VALUES
  ('directory.read',          'directory', 'read',    true,  false, 'colaborador', 'Ver nome, email, departamento e cargo dos colaboradores (nunca dados de RH)'),
  ('tickets.read',            'tickets',   'read',    true,  false, 'colaborador', 'Ver tickets, respostas e anexos (sem notas internas)'),
  ('tickets.write',           'tickets',   'write',   true,  false, 'gestor',      'Responder a tickets e alterar estado, prioridade, departamento e responsável'),
  ('tickets.notes',           'tickets',   'special', true,  true,  'admin',       'Ler e escrever as notas internas dos tickets'),
  ('access.read',             'access',    'read',    true,  true,  'admin',       'Ver os acessos (título, utilizador, endereço, categoria), sem a palavra-passe'),
  ('access.reveal',           'access',    'special', true,  true,  'admin',       'Mostrar a palavra-passe de um acesso (uma auditoria por chamada)'),
  ('access.write',            'access',    'write',   true,  true,  'admin',       'Criar e alterar acessos e categorias'),
  ('mail.accounts.read',      'mail',      'read',    true,  true,  'gestor',      'Ver as caixas de email (endereço, nome, fornecedor, estado), sem segredos'),
  ('mail.use',                'mail',      'special', true,  true,  'colaborador', 'Usar caixas de email da empresa dona como membro (ler e enviar)'),
  ('mail.assign_to_employees','mail',      'write',   true,  true,  'admin',       'Ligar caixas próprias a colaboradores da empresa dona (sem acesso a RH)'),
  ('chat.participate',        'chat',      'special', true,  false, 'colaborador', 'Participar em conversas criadas na empresa dona, só aquelas em que é membro'),
  ('tasks.read',              'tasks',     'read',    true,  false, 'colaborador', 'Ver tarefas e eventos de calendário da empresa'),
  ('tasks.write',             'tasks',     'write',   true,  false, 'gestor',      'Criar e alterar tarefas, comentários e listas'),
  ('equipment.read',          'equipment', 'read',    true,  false, 'gestor',      'Ver equipamentos, telefones, atribuições e serviços recorrentes'),
  ('equipment.write',         'equipment', 'write',   true,  false, 'admin',       'Criar e alterar equipamentos, telefones, atribuições e serviços'),
  ('feed.read',               'feed',      'read',    true,  false, 'colaborador', 'Ver os comunicados de grupo do feed'),
  ('hr.read',                 'hr',        'read',    false, true,  'admin',       'RH (documentos, férias, ponto): nunca se partilha entre empresas'),
  ('finance.read',            'finance',   'read',    false, true,  'admin',       'Financeiro (salários, jurídico, domínios): nunca se partilha entre empresas'),
  ('docs.read',               'docs',      'read',    false, true,  'admin',       'Documentos: nunca se partilha entre empresas')
ON CONFLICT (capability) DO NOTHING;

INSERT INTO public.module_flags (module, enabled)
SELECT v.module, false
FROM (VALUES
  ('membership'), ('signup'), ('tickets'), ('access'), ('mail'), ('chat'), ('tasks'),
  ('notifications'), ('feed'), ('equipment'), ('hr'), ('docs'), ('finance')
) AS v(module)
ON CONFLICT (module) DO NOTHING;

-- ============================================================================================
-- DIVERGÊNCIAS CONHECIDAS E INTENCIONAIS face à base real (a endurecer na Fase B, na base real)
--   * Sequências share_request_attempts_id_seq: na base real anon e authenticated têm rwU;
--     aqui só service_role (versão mais restrita, de propósito).
--   * Partições mensais: ACL real arwdDxtm (postgres + service_role); aqui o REVOKE de
--     PUBLIC/anon/authenticated e os privilégios por omissão do Supabase dão o mesmo resultado.
--
-- AINDA POR CONFIRMAR
--   * Posse (postgres) das partições e sequências criadas pela migração: depende de quem a corre.
--   * Linha base: FK e CHECK de capability_catalog, company_*, support_access_grants vêm da fonte
--     anterior; não há prova de que a lista esteja completa para platform_admins/module_flags
--     além das constraints listadas no JSON da base real.
-- ============================================================================================
