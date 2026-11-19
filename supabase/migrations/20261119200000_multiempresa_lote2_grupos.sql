-- Multiempresa, Lote 2: gestão de grupos de empresas (criar, renomear, definir empresas, módulos por
-- defeito e dissolver). Só super admin. NÃO altera a regra de leitura: os módulos do grupo só ficam
-- guardados aqui; quem os aplica (RLS, Feed, diretório) é o Lote 3.
--
--   1. company_groups.default_capabilities text[] (por defeito '{}': os 2 grupos atuais não expõem nada).
--   2. company_group_members.origin passa a aceitar 'manual'; cross_company_audit.action passa a aceitar
--      group_create, group_update, group_members, group_capabilities e group_dissolve.
--      (cross_company_audit é particionada: DROP/ADD CONSTRAINT no pai propaga-se às partições e
--      valida-as; é uma tabela pequena, por isso o bloqueio é breve. Se preferir não mexer no CHECK,
--      troque as 5 ações por 'flag_change' nas funções abaixo.)
--   3. Funções públicas (SECURITY DEFINER, search_path fixo, só super admin + login recente):
--        rz_create_group, rz_rename_group, rz_set_group_members, rz_set_group_capabilities, rz_dissolve_group.
--      Funções internas (só service_role): rz_group_assert_super, rz_group_name, rz_group_caps,
--      rz_group_clean_companies, rz_group_check_companies, rz_group_revoke_between, rz_group_audit.
--   4. rz_list_groups() e rz_list_group(uuid) passam a devolver também default_capabilities
--      (DROP + CREATE porque o tipo de retorno muda; mesmas regras de acesso e mesmos grants).
--
-- rz_leave_group NÃO é alterado (a lógica de revogar partilhas foi escrita à parte em
-- rz_group_revoke_between, para o comportamento atual não correr risco).
--
-- Regras: cada empresa fica no máximo num grupo ativo (garantido aqui, com um lock de aviso que
-- serializa as escritas de grupos; NÃO há índice único, porque rz_approve_share pode hoje juntar a
-- requerente ao grupo da alvo sem verificar se ela já está noutro: ver o relatório do Lote 2).
-- Não se apagam linhas: sair é status 'saiu' com left_at (histórico).
--
-- Repetível. Reversão: supabase/rollbacks/20261119200000_multiempresa_lote2_grupos_rollback.sql
-- Ensaio (transação anulada): supabase/tests/multiempresa_lote2_ensaio.sql
-- NÃO aplicar sem autorização. Aplicar no SQL Editor, numa única chamada.

-- ============================================================================================
-- 1. Módulos por defeito do grupo
-- ============================================================================================
ALTER TABLE public.company_groups
  ADD COLUMN IF NOT EXISTS default_capabilities text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.company_groups.default_capabilities IS
  'Capacidades de leitura (catálogo: read, grantable, não sensível) que as empresas do grupo veem umas das outras. Só configuração: a regra de leitura é aplicada noutro lote.';

-- ============================================================================================
-- 2. CHECKs alargados
-- ============================================================================================
ALTER TABLE public.company_group_members
  DROP CONSTRAINT IF EXISTS company_group_members_origin_check;
ALTER TABLE public.company_group_members
  ADD CONSTRAINT company_group_members_origin_check
  CHECK ((origin = ANY (ARRAY['pedido'::text, 'migracao'::text, 'manual'::text])));

ALTER TABLE public.cross_company_audit
  DROP CONSTRAINT IF EXISTS cross_company_audit_action_check;
ALTER TABLE public.cross_company_audit
  ADD CONSTRAINT cross_company_audit_action_check
  CHECK ((action = ANY (ARRAY['read'::text, 'write'::text, 'delete'::text, 'export'::text, 'reveal'::text,
    'support_read'::text, 'support_grant'::text, 'support_revoke'::text, 'share_request'::text,
    'share_approve'::text, 'share_revoke'::text, 'flag_change'::text, 'super_admin_access'::text,
    'group_create'::text, 'group_update'::text, 'group_members'::text, 'group_capabilities'::text,
    'group_dissolve'::text])));

-- ============================================================================================
-- 3. Funções internas
-- ============================================================================================

-- Quem chama tem de ser super admin com login recente (a ordem importa: sem ser super admin, nem se pede a palavra-passe).
CREATE OR REPLACE FUNCTION public.rz_group_assert_super()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user uuid := public.rz_uid();
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  PERFORM public.rz_assert_recent_auth();
  RETURN v_user;
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_group_name(p_name text)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_name text := btrim(p_name);
BEGIN
  IF v_name IS NULL OR v_name = '' OR char_length(v_name) > 80 THEN
    PERFORM public.rz_fail('invalid_argument', 'O nome do grupo é obrigatório e tem no máximo 80 caracteres.');
  END IF;
  RETURN v_name;
END;
$function$;

-- Só capacidades do catálogo, de leitura, partilháveis e não sensíveis.
CREATE OR REPLACE FUNCTION public.rz_group_caps(p_caps text[])
 RETURNS text[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caps text[] := public.rz_validate_caps(p_caps, true);
BEGIN
  IF cardinality(v_caps) > 20 THEN
    PERFORM public.rz_fail('invalid_argument', 'Escolheu módulos a mais.');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.capability_catalog c
     WHERE c.capability = ANY (v_caps) AND (c.kind <> 'read' OR c.sensitive)
  ) THEN
    PERFORM public.rz_fail('invalid_argument',
      'Só módulos de leitura e não sensíveis podem ser definidos por defeito no grupo.');
  END IF;
  RETURN coalesce((SELECT array_agg(c ORDER BY c) FROM unnest(v_caps) c), ARRAY[]::text[]);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_group_clean_companies(p_companies uuid[])
 RETURNS uuid[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT coalesce(array_agg(DISTINCT c ORDER BY c), ARRAY[]::uuid[])
  FROM unnest(p_companies) c WHERE c IS NOT NULL;
$function$;

-- As empresas a juntar existem, estão ativas e não estão noutro grupo ativo (p_group = o grupo de destino, se já existe).
CREATE OR REPLACE FUNCTION public.rz_group_check_companies(p_companies uuid[], p_group uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row record;
BEGIN
  FOR v_row IN
    SELECT u.id AS wanted, c.id AS found, c.name, c.is_active
    FROM unnest(p_companies) AS u(id)
    LEFT JOIN public.companies c ON c.id = u.id
    ORDER BY c.name
  LOOP
    IF v_row.found IS NULL THEN
      PERFORM public.rz_fail('invalid_argument', 'Empresa não encontrada.');
    END IF;
    IF NOT v_row.is_active THEN
      PERFORM public.rz_fail('invalid_argument', format('A empresa %s está inativa.', v_row.name));
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.company_group_members m
       WHERE m.company_id = v_row.wanted AND m.status = 'ativo'
         AND (p_group IS NULL OR m.group_id <> p_group)
    ) THEN
      PERFORM public.rz_fail('invalid_argument', format('A empresa %s já pertence a um grupo.', v_row.name));
    END IF;
  END LOOP;
END;
$function$;

-- Revoga as partilhas ativas ou pedidas entre dois conjuntos de empresas (nos dois sentidos) e audita cada uma.
-- Mesma lógica de rz_leave_group, sem alterar essa função.
CREATE OR REPLACE FUNCTION public.rz_group_revoke_between(p_actor uuid, p_from uuid[], p_to uuid[], p_reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_n   integer := 0;
  v_row record;
BEGIN
  IF coalesce(cardinality(p_from), 0) = 0 OR coalesce(cardinality(p_to), 0) = 0 THEN
    RETURN 0;
  END IF;
  FOR v_row IN
    WITH upd AS (
      UPDATE public.company_shares
         SET status = 'revogado', revoked_by = p_actor, revoke_reason = p_reason
       WHERE status IN ('pedido', 'aprovado')
         AND ((owner_company_id = ANY (p_from) AND grantee_company_id = ANY (p_to))
           OR (grantee_company_id = ANY (p_from) AND owner_company_id = ANY (p_to)))
      RETURNING id, owner_company_id, capability
    )
    SELECT id, owner_company_id, capability FROM upd
  LOOP
    v_n := v_n + 1;
    PERFORM public.rz_audit_cross(p_actor, NULL, v_row.owner_company_id, v_row.capability,
                                  'share_revoke', 'company_share', v_row.id, v_row.id);
  END LOOP;
  RETURN v_n;
END;
$function$;

-- Uma linha de auditoria por empresa afetada.
CREATE OR REPLACE FUNCTION public.rz_group_audit(p_actor uuid, p_action text, p_group uuid, p_companies uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_company uuid;
BEGIN
  FOREACH v_company IN ARRAY coalesce(p_companies, ARRAY[]::uuid[]) LOOP
    PERFORM public.rz_audit_cross(p_actor, NULL, v_company, NULL, p_action, 'company_group', p_group);
  END LOOP;
END;
$function$;

-- ============================================================================================
-- 4. Funções públicas (super admin)
-- ============================================================================================
CREATE OR REPLACE FUNCTION public.rz_create_group(
  p_name text,
  p_companies uuid[],
  p_capabilities text[] DEFAULT ARRAY['directory.read', 'feed.read']::text[]
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user  uuid;
  v_name  text;
  v_comps uuid[];
  v_caps  text[];
  v_group uuid;
BEGIN
  v_user := public.rz_group_assert_super();
  PERFORM pg_advisory_xact_lock(hashtext('rz_groups'));
  v_name := public.rz_group_name(p_name);
  v_comps := public.rz_group_clean_companies(p_companies);
  IF cardinality(v_comps) < 2 THEN
    PERFORM public.rz_fail('invalid_argument', 'Escolha pelo menos 2 empresas diferentes.');
  END IF;
  PERFORM public.rz_group_check_companies(v_comps, NULL);
  v_caps := public.rz_group_caps(p_capabilities);

  INSERT INTO public.company_groups (name, created_by_company_id, default_capabilities)
  VALUES (v_name, NULL, v_caps)
  RETURNING id INTO v_group;
  INSERT INTO public.company_group_members (group_id, company_id, status, origin)
  SELECT v_group, c, 'ativo', 'manual' FROM unnest(v_comps) c;

  PERFORM public.rz_group_audit(v_user, 'group_create', v_group, v_comps);
  RETURN jsonb_build_object('group_id', v_group);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_rename_group(p_group uuid, p_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid;
  v_name    text;
  v_members uuid[];
BEGIN
  v_user := public.rz_group_assert_super();
  PERFORM pg_advisory_xact_lock(hashtext('rz_groups'));
  v_name := public.rz_group_name(p_name);
  PERFORM 1 FROM public.company_groups g WHERE g.id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  SELECT coalesce(array_agg(m.company_id), ARRAY[]::uuid[]) INTO v_members
    FROM public.company_group_members m WHERE m.group_id = p_group AND m.status = 'ativo';
  IF cardinality(v_members) = 0 THEN
    PERFORM public.rz_fail('not_found', 'Este grupo já foi dissolvido.');
  END IF;
  UPDATE public.company_groups SET name = v_name WHERE id = p_group;
  PERFORM public.rz_group_audit(v_user, 'group_update', p_group, v_members);
  RETURN jsonb_build_object('group_id', p_group, 'name', v_name);
END;
$function$;

-- Define o conjunto completo de empresas do grupo: junta as novas e retira as que faltam
-- (revogando as partilhas entre cada empresa retirada e as que estavam no grupo).
CREATE OR REPLACE FUNCTION public.rz_set_group_members(p_group uuid, p_companies uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid;
  v_new     uuid[];
  v_current uuid[];
  v_add     uuid[];
  v_remove  uuid[];
  v_revoked integer := 0;
BEGIN
  v_user := public.rz_group_assert_super();
  PERFORM pg_advisory_xact_lock(hashtext('rz_groups'));
  PERFORM 1 FROM public.company_groups g WHERE g.id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  SELECT coalesce(array_agg(m.company_id), ARRAY[]::uuid[]) INTO v_current
    FROM public.company_group_members m WHERE m.group_id = p_group AND m.status = 'ativo';
  IF cardinality(v_current) = 0 THEN
    PERFORM public.rz_fail('not_found', 'Este grupo já foi dissolvido.');
  END IF;

  v_new := public.rz_group_clean_companies(p_companies);
  IF cardinality(v_new) < 2 THEN
    PERFORM public.rz_fail('invalid_argument', 'Um grupo precisa de pelo menos 2 empresas; use Dissolver.');
  END IF;
  v_add := ARRAY(SELECT c FROM unnest(v_new) c WHERE NOT (c = ANY (v_current)));
  v_remove := ARRAY(SELECT c FROM unnest(v_current) c WHERE NOT (c = ANY (v_new)));
  PERFORM public.rz_group_check_companies(v_add, p_group);

  IF cardinality(v_remove) > 0 THEN
    v_revoked := public.rz_group_revoke_between(v_user, v_remove, v_current, 'Saída do grupo');
    UPDATE public.company_group_members
       SET status = 'saiu', left_at = now()
     WHERE group_id = p_group AND status = 'ativo' AND company_id = ANY (v_remove);
  END IF;
  IF cardinality(v_add) > 0 THEN
    INSERT INTO public.company_group_members (group_id, company_id, status, origin)
    SELECT p_group, c, 'ativo', 'manual' FROM unnest(v_add) c
    ON CONFLICT (group_id, company_id)
    DO UPDATE SET status = 'ativo', origin = 'manual', joined_at = now(), left_at = NULL;
  END IF;

  PERFORM public.rz_group_audit(v_user, 'group_members', p_group, v_add || v_remove);
  RETURN jsonb_build_object('group_id', p_group, 'added', cardinality(v_add),
                            'removed', cardinality(v_remove), 'revoked', v_revoked);
END;
$function$;

CREATE OR REPLACE FUNCTION public.rz_set_group_capabilities(p_group uuid, p_capabilities text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid;
  v_caps    text[];
  v_members uuid[];
BEGIN
  v_user := public.rz_group_assert_super();
  PERFORM pg_advisory_xact_lock(hashtext('rz_groups'));
  PERFORM 1 FROM public.company_groups g WHERE g.id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  SELECT coalesce(array_agg(m.company_id), ARRAY[]::uuid[]) INTO v_members
    FROM public.company_group_members m WHERE m.group_id = p_group AND m.status = 'ativo';
  IF cardinality(v_members) = 0 THEN
    PERFORM public.rz_fail('not_found', 'Este grupo já foi dissolvido.');
  END IF;
  v_caps := public.rz_group_caps(p_capabilities);
  UPDATE public.company_groups SET default_capabilities = v_caps WHERE id = p_group;
  PERFORM public.rz_group_audit(v_user, 'group_capabilities', p_group, v_members);
  RETURN jsonb_build_object('group_id', p_group, 'capabilities', to_jsonb(v_caps));
END;
$function$;

-- Dissolve: todas as empresas saem (status 'saiu'), as partilhas entre elas são revogadas e nada se apaga.
CREATE OR REPLACE FUNCTION public.rz_dissolve_group(p_group uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user    uuid;
  v_members uuid[];
  v_revoked integer;
BEGIN
  v_user := public.rz_group_assert_super();
  PERFORM pg_advisory_xact_lock(hashtext('rz_groups'));
  PERFORM 1 FROM public.company_groups g WHERE g.id = p_group FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.rz_fail('not_found', 'Grupo não encontrado.');
  END IF;
  SELECT coalesce(array_agg(m.company_id), ARRAY[]::uuid[]) INTO v_members
    FROM public.company_group_members m WHERE m.group_id = p_group AND m.status = 'ativo';
  IF cardinality(v_members) = 0 THEN
    PERFORM public.rz_fail('not_found', 'Este grupo já foi dissolvido.');
  END IF;
  v_revoked := public.rz_group_revoke_between(v_user, v_members, v_members, 'Grupo dissolvido');
  UPDATE public.company_group_members
     SET status = 'saiu', left_at = now()
   WHERE group_id = p_group AND status = 'ativo';
  PERFORM public.rz_group_audit(v_user, 'group_dissolve', p_group, v_members);
  RETURN jsonb_build_object('group_id', p_group, 'revoked', v_revoked);
END;
$function$;

-- ============================================================================================
-- 5. Leituras: passam a trazer default_capabilities
-- ============================================================================================
DROP FUNCTION IF EXISTS public.rz_list_groups();

CREATE FUNCTION public.rz_list_groups()
 RETURNS TABLE(group_id uuid, group_name text, group_created_at timestamp with time zone, company_id uuid, company_name text, joined_at timestamp with time zone, origin text, default_capabilities text[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.rz_is_super_admin() THEN
    PERFORM public.rz_fail('not_platform_admin');
  END IF;
  RETURN QUERY
  SELECT g.id, g.name, g.created_at, c.id, c.name, m.joined_at, m.origin, g.default_capabilities
  FROM public.company_groups g
  JOIN public.company_group_members m ON m.group_id = g.id AND m.status = 'ativo'
  JOIN public.companies c ON c.id = m.company_id
  ORDER BY g.name, c.name;
END;
$function$;

DROP FUNCTION IF EXISTS public.rz_list_group(uuid);

CREATE FUNCTION public.rz_list_group(p_company uuid)
 RETURNS TABLE(group_id uuid, company_id uuid, name text, joined_at timestamp with time zone, origin text, is_me boolean, default_capabilities text[])
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
  SELECT m.group_id, m.company_id, c.name, m.joined_at, m.origin, (m.company_id = p_company),
         g.default_capabilities
  FROM public.company_group_members m
  JOIN public.company_groups g ON g.id = m.group_id
  JOIN public.companies c ON c.id = m.company_id
  WHERE m.status = 'ativo'
    AND m.group_id IN (SELECT x.group_id FROM public.company_group_members x
                        WHERE x.company_id = p_company AND x.status = 'ativo')
  ORDER BY m.group_id, c.name;
END;
$function$;

-- ============================================================================================
-- 6. Permissões
-- ============================================================================================
DO $acl$
DECLARE
  s text;
BEGIN
  FOREACH s IN ARRAY ARRAY[
    'rz_group_assert_super()', 'rz_group_name(text)', 'rz_group_caps(text[])',
    'rz_group_clean_companies(uuid[])', 'rz_group_check_companies(uuid[], uuid)',
    'rz_group_revoke_between(uuid, uuid[], uuid[], text)', 'rz_group_audit(uuid, text, uuid, uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', s);
  END LOOP;

  FOREACH s IN ARRAY ARRAY[
    'rz_create_group(text, uuid[], text[])', 'rz_rename_group(uuid, text)',
    'rz_set_group_members(uuid, uuid[])', 'rz_set_group_capabilities(uuid, text[])',
    'rz_dissolve_group(uuid)', 'rz_list_groups()', 'rz_list_group(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', s);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated, service_role', s);
  END LOOP;
END
$acl$;
